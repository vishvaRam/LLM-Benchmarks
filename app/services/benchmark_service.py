import base64
import json
import time
from collections.abc import AsyncGenerator

import pymupdf
from openai import AsyncOpenAI

from app.routers.templates import TEMPLATE_STORE
from app.schemas.benchmark import BenchmarkRequest
from app.services.endpoint_store import EndpointStore
from app.services.metrics import MetricsTracker


def normalize_base_url(base_url: str) -> str:
    url = (base_url or "").strip().rstrip("/")
    if url and not url.endswith("/v1"):
        url = f"{url}/v1"
    return url

def pdf_to_base64_images(pdf_bytes: bytes, mode: str = "first", max_pages: int | None = None) -> list[str]:
    """
    mode: 'first', 'all', or 'custom'
    """
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    total = len(doc)
    
    if mode == "first":
        page_indices = [0] if total > 0 else []
    elif mode == "all":
        page_indices = list(range(total))
    else: # custom limit
        limit = min(max_pages or 1, total)
        page_indices = list(range(limit))

    images = []
    for idx in page_indices:
        page = doc[idx]
        # 150 DPI matrix for crisp VLM reading
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        images.append(f"data:image/png;base64,{b64}")
    
    doc.close()
    return images

class ThinkTagStreamParser:
    """
    Parses streaming text chunks to detect and separate <think>...</think> reasoning traces
    from actual response content when models stream thinking tags directly in delta.content.
    """

    def __init__(self):
        self.in_think = False
        self.buffer = ""

    def process_chunk(self, chunk: str) -> list[tuple[str, str]]:
        """
        Takes an incoming text chunk and yields a list of (type, delta) tuples
        where type is either 'thinking' or 'content'.
        """
        if not chunk:
            return []

        self.buffer += chunk
        events: list[tuple[str, str]] = []

        while self.buffer:
            if not self.in_think:
                # Look for opening <think>
                lower_buf = self.buffer.lower()
                open_pos = lower_buf.find("<think>")
                if open_pos != -1:
                    # Emit any content before <think>
                    if open_pos > 0:
                        events.append(("content", self.buffer[:open_pos]))
                    self.in_think = True
                    self.buffer = self.buffer[open_pos + len("<think>") :]
                    # Strip leading newline if right after <think>
                    self.buffer = self.buffer.removeprefix("\n")
                else:
                    # Check for partial prefix of "<think>" at end of buffer
                    partial_match = False
                    for i in range(1, min(len("<think>"), len(self.buffer) + 1)):
                        if "<think>".startswith(lower_buf[-i:]):
                            # Hold back this potential prefix
                            if len(self.buffer) > i:
                                events.append(("content", self.buffer[:-i]))
                                self.buffer = self.buffer[-i:]
                            partial_match = True
                            break
                    if not partial_match:
                        events.append(("content", self.buffer))
                        self.buffer = ""
                    else:
                        break
            else:
                # We are currently inside a <think> block, look for closing </think>
                lower_buf = self.buffer.lower()
                close_pos = lower_buf.find("</think>")
                if close_pos != -1:
                    # Emit reasoning trace up to </think>
                    if close_pos > 0:
                        events.append(("thinking", self.buffer[:close_pos]))
                    self.in_think = False
                    self.buffer = self.buffer[close_pos + len("</think>") :]
                    # Strip leading newline if right after </think>
                    self.buffer = self.buffer.removeprefix("\n")
                else:
                    # Check for partial prefix of "</think>" at end of buffer
                    partial_match = False
                    for i in range(1, min(len("</think>"), len(self.buffer) + 1)):
                        if "</think>".startswith(lower_buf[-i:]):
                            if len(self.buffer) > i:
                                events.append(("thinking", self.buffer[:-i]))
                                self.buffer = self.buffer[-i:]
                            partial_match = True
                            break
                    if not partial_match:
                        events.append(("thinking", self.buffer))
                        self.buffer = ""
                    else:
                        break

        return events

    def flush(self) -> list[tuple[str, str]]:
        """Flush any remaining buffered text at stream end."""
        events: list[tuple[str, str]] = []
        if self.buffer:
            t = "thinking" if self.in_think else "content"
            events.append((t, self.buffer))
            self.buffer = ""
        return events


class BenchmarkService:
    @staticmethod
    def _build_messages(req: BenchmarkRequest) -> list[dict]:
        messages: list[dict] = []
        system_prompt = None
        user_text = ""
        # 1. Prioritize image passed in root request, then prompt_payload, then template
        image_url = req.image_url

        if req.template_id:
            tpl = TEMPLATE_STORE.get(req.template_id)
            if not tpl:
                raise ValueError(f"Template '{req.template_id}' not found.")
            variables = tpl.default_variables.copy()
            if req.template_variables:
                variables.update(req.template_variables)
            user_text = tpl.template.format(**variables)
            system_prompt = tpl.system_prompt
            if not image_url:
                image_url = tpl.sample_image_url
        elif req.prompt_payload:
            system_prompt = req.prompt_payload.system_prompt
            user_text = req.prompt_payload.prompt
            if not image_url:
                image_url = req.prompt_payload.image_url
        else:
            raise ValueError("Must provide either 'template_id' or 'prompt_payload'.")

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        # Combine image_urls list and single image_url fallback
        all_images = list(req.image_urls or [])
        if image_url and image_url not in all_images:
            all_images.insert(0, image_url)

        if all_images:
            user_content: list[dict] = [{"type": "text", "text": user_text}]
            for img in all_images:
                user_content.append({"type": "image_url", "image_url": {"url": img}})
            messages.append({"role": "user", "content": user_content})
        else:
            messages.append({"role": "user", "content": user_text})

        return messages

    @classmethod
    async def stream_benchmark(cls, req: BenchmarkRequest) -> AsyncGenerator[str, None]:
        if req.endpoint_id:
            registered_ep = EndpointStore.get(req.endpoint_id)
            if not registered_ep:
                yield f"data: {json.dumps({'type': 'error', 'message': f'Endpoint {req.endpoint_id} not found'})}\n\n"
                return
            base_url = normalize_base_url(registered_ep.base_url)
            api_key = registered_ep.api_key
            default_headers = registered_ep.headers
        elif req.endpoint:
            base_url = normalize_base_url(req.endpoint.base_url)
            api_key = req.endpoint.api_key
            default_headers = None
        else:
            yield f"data: {json.dumps({'type': 'error', 'message': 'No endpoint specified'})}\n\n"
            return

        client = AsyncOpenAI(
            base_url=base_url,
            api_key=api_key,
            default_headers=default_headers,
        )

        try:
            messages = cls._build_messages(req)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            return

        tracker = MetricsTracker()

        extra_body = dict(req.parameters.extra_body or {})
        chat_template_kwargs = dict(extra_body.get("chat_template_kwargs") or {})

        if req.parameters.enable_thinking:
            chat_template_kwargs["enable_thinking"] = True
            if "reasoning_effort" not in chat_template_kwargs:
                chat_template_kwargs["reasoning_effort"] = "high"
            extra_body["chat_template_kwargs"] = chat_template_kwargs
            extra_body["enable_thinking"] = True
            if req.parameters.thinking_budget_tokens:
                extra_body["max_reasoning_tokens"] = (
                    req.parameters.thinking_budget_tokens
                )
                chat_template_kwargs["max_reasoning_tokens"] = (
                    req.parameters.thinking_budget_tokens
                )
        else:
            chat_template_kwargs["enable_thinking"] = False
            extra_body["chat_template_kwargs"] = chat_template_kwargs
            extra_body["enable_thinking"] = False

        kwargs: dict = {
            "model": req.parameters.model,
            "messages": messages,
            "temperature": req.parameters.temperature,
            "top_p": req.parameters.top_p,
            "max_tokens": req.parameters.max_tokens,
            "stream": req.parameters.stream,
        }
        if extra_body:
            kwargs["extra_body"] = extra_body

        start_time = time.perf_counter()

        try:
            if req.parameters.stream:
                last_token_time = start_time
                first_token_received = False
                tag_parser = ThinkTagStreamParser()

                response_stream = await client.chat.completions.create(**kwargs)

                async for chunk in response_stream:
                    current_time = time.perf_counter()
                    if not chunk.choices:
                        continue

                    choice = chunk.choices[0]
                    delta = choice.delta

                    if choice.finish_reason:
                        tracker.finish_reason = choice.finish_reason

                    # Extract reasoning chunk from SDK attribute or model_extra
                    reasoning_chunk = (
                        getattr(delta, "reasoning_content", None)
                        or getattr(delta, "reasoning", None)
                        or (getattr(delta, "model_extra", None) or {}).get(
                            "reasoning_content"
                        )
                        or (getattr(delta, "model_extra", None) or {}).get("reasoning")
                    )
                    text_chunk = delta.content or ""

                    if reasoning_chunk or text_chunk:
                        tracker.output_tokens += 1
                        if not first_token_received:
                            tracker.ttft_ms = (current_time - start_time) * 1000.0
                            first_token_received = True
                        else:
                            itl = (current_time - last_token_time) * 1000.0
                            tracker.inter_token_latencies_ms.append(itl)
                        last_token_time = current_time

                    if reasoning_chunk:
                        tracker.thinking_tokens += 1
                        yield f"data: {json.dumps({'type': 'thinking', 'delta': reasoning_chunk})}\n\n"

                    if text_chunk:
                        # Parse any <think>...</think> tags inside content stream
                        for event_type, segment in tag_parser.process_chunk(text_chunk):
                            if not segment:
                                continue
                            if event_type == "thinking":
                                tracker.thinking_tokens += 1
                                yield f"data: {json.dumps({'type': 'thinking', 'delta': segment})}\n\n"
                            else:
                                tracker.content_tokens += 1
                                yield f"data: {json.dumps({'type': 'content', 'delta': segment})}\n\n"

                # Flush any leftover parser buffer
                for event_type, segment in tag_parser.flush():
                    if not segment:
                        continue
                    if event_type == "thinking":
                        tracker.thinking_tokens += 1
                        yield f"data: {json.dumps({'type': 'thinking', 'delta': segment})}\n\n"
                    else:
                        tracker.content_tokens += 1
                        yield f"data: {json.dumps({'type': 'content', 'delta': segment})}\n\n"

                tracker.total_latency_ms = (time.perf_counter() - start_time) * 1000.0

            else:
                res = await client.chat.completions.create(**kwargs)
                end_time = time.perf_counter()

                tracker.total_latency_ms = (end_time - start_time) * 1000.0
                tracker.ttft_ms = tracker.total_latency_ms

                choice = res.choices[0]
                tracker.finish_reason = choice.finish_reason
                reasoning = (
                    getattr(choice.message, "reasoning_content", None)
                    or getattr(choice.message, "reasoning", None)
                    or (getattr(choice.message, "model_extra", None) or {}).get(
                        "reasoning_content"
                    )
                    or (getattr(choice.message, "model_extra", None) or {}).get(
                        "reasoning"
                    )
                )
                content = choice.message.content or ""

                # If no explicit reasoning_content attribute, check for <think> tags in content
                if not reasoning and "<think>" in content.lower():
                    import re

                    match = re.search(
                        r"<think>(.*?)</think>",
                        content,
                        flags=re.DOTALL | re.IGNORECASE,
                    )
                    if match:
                        reasoning = match.group(1).strip()
                        content = re.sub(
                            r"<think>.*?</think>",
                            "",
                            content,
                            flags=re.DOTALL | re.IGNORECASE,
                        ).strip()

                if res.usage:
                    tracker.output_tokens = res.usage.completion_tokens
                    tracker.content_tokens = res.usage.completion_tokens

                if reasoning:
                    yield f"data: {json.dumps({'type': 'thinking', 'delta': reasoning})}\n\n"
                if content:
                    yield f"data: {json.dumps({'type': 'content', 'delta': content})}\n\n"

            # Yield final calculated benchmark metrics at the end of the stream
            metrics_data = tracker.compute().model_dump()
            yield f"data: {json.dumps({'type': 'metrics', 'metrics': metrics_data})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
