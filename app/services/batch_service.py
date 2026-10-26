import asyncio
import json
import random
import time
from collections.abc import AsyncGenerator

import httpx
from openai import AsyncOpenAI

from app.schemas.batch import BatchBenchmarkRequest, DatasetSourceConfig, SampleResult
from app.services.benchmark_service import ThinkTagStreamParser, normalize_base_url
from app.services.endpoint_store import EndpointStore


class BatchService:
    @staticmethod
    async def _get_dataset_split_length(
        client: httpx.AsyncClient, cfg: DatasetSourceConfig
    ) -> int | None:
        """Query HF Serverless API to determine the total row count of the split."""
        try:
            size_url = "https://datasets-server.huggingface.co/size"
            res = await client.get(size_url, params={"dataset": cfg.dataset_name})
            if res.status_code == 200:
                data = res.json()
                splits = (
                    data.get("size", {})
                    .get("splits", [])
                )
                for s in splits:
                    if s.get("config") == cfg.config and s.get("split") == cfg.split:
                        return s.get("num_rows")
        except Exception:
            pass
        return None

    @classmethod
    async def fetch_hf_samples(cls, cfg: DatasetSourceConfig) -> list[str]:
        """Fetch sample prompts using Hugging Face datasets rows API with shuffle & seed support."""
        rows_url = "https://datasets-server.huggingface.co/rows"

        # Initialize RNG with seed if given; else system randomness
        rng = random.Random(cfg.seed)

        async with httpx.AsyncClient(timeout=15.0) as client:
            offset = 0
            fetch_length = cfg.num_samples

            if getattr(cfg, "shuffle", False):
                total_rows = await cls._get_dataset_split_length(client, cfg)

                if total_rows and total_rows > cfg.num_samples:
                    # Choose a random offset window within total bounds
                    max_offset = max(0, total_rows - cfg.num_samples)
                    offset = rng.randint(0, max_offset)
                else:
                    # If total length unavailable or small, request a larger pool (up to 100 max per HF API call)
                    fetch_length = min(100, max(cfg.num_samples * 2, 20))

            params = {
                "dataset": cfg.dataset_name,
                "config": cfg.config,
                "split": cfg.split,
                "offset": offset,
                "length": fetch_length,
            }

            res = await client.get(rows_url, params=params)
            if res.status_code != 200:
                raise ValueError(
                    f"Hugging Face API returned error ({res.status_code}): {res.text}. "
                    "Verify the dataset name, config, and split."
                )

            data = res.json()
            rows = data.get("rows", [])
            prompts: list[str] = []

            for item in rows:
                row_data = item.get("row", {})
                val = row_data.get(cfg.prompt_column)
                if val:
                    prompts.append(str(val))

            if not prompts:
                raise ValueError(
                    f"Column '{cfg.prompt_column}' was empty or not found in dataset rows."
                )

            # In-memory shuffle on the fetched pool
            if getattr(cfg, "shuffle", False):
                rng.shuffle(prompts)

            return prompts[: cfg.num_samples]

    @classmethod
    async def run_batch_stream(
        cls, req: BatchBenchmarkRequest
    ) -> AsyncGenerator[str, None]:
        registered_ep = EndpointStore.get(req.endpoint_id)
        if not registered_ep:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Endpoint {req.endpoint_id} not found'})}\n\n"
            return

        seed_info = f" (seed={req.dataset.seed})" if req.dataset.seed is not None else ""
        shuffle_info = "randomized" if getattr(req.dataset, "shuffle", False) else "sequential"
        yield f"data: {json.dumps({'type': 'status', 'message': f'Fetching {req.dataset.num_samples} {shuffle_info} samples{seed_info} from HF ({req.dataset.dataset_name})...'})}\n\n"

        try:
            prompts = await cls.fetch_hf_samples(req.dataset)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Failed loading dataset: {e!s}'})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'status', 'message': f'Dataset loaded. Launching benchmark with concurrency={req.concurrency_limit}...', 'total': len(prompts)})}\n\n"

        client = AsyncOpenAI(
            base_url=normalize_base_url(registered_ep.base_url),
            api_key=registered_ep.api_key,
            default_headers=registered_ep.headers,
        )

        semaphore = asyncio.Semaphore(req.concurrency_limit)
        results: list[SampleResult] = []
        start_time_all = time.perf_counter()

        async def benchmark_single(idx: int, prompt_text: str) -> SampleResult:
            async with semaphore:
                messages = []
                if req.dataset.system_prompt:
                    messages.append(
                        {"role": "system", "content": req.dataset.system_prompt}
                    )
                messages.append({"role": "user", "content": prompt_text})

                extra_body = dict(req.parameters.extra_body or {})
                chat_template_kwargs = dict(
                    extra_body.get("chat_template_kwargs") or {}
                )

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

                kwargs = {
                    "model": req.parameters.model,
                    "messages": messages,
                    "temperature": req.parameters.temperature,
                    "top_p": req.parameters.top_p,
                    "max_tokens": req.parameters.max_tokens,
                    "stream": True,
                }
                if extra_body:
                    kwargs["extra_body"] = extra_body

                t0 = time.perf_counter()
                ttft_ms = 0.0
                first_token = False
                tokens_count = 0
                thinking_count = 0
                content_parts = []
                tag_parser = ThinkTagStreamParser()

                try:
                    stream = await client.chat.completions.create(**kwargs)
                    async for chunk in stream:
                        now = time.perf_counter()
                        if not chunk.choices:
                            continue
                        delta = chunk.choices[0].delta
                        r_chunk = (
                            getattr(delta, "reasoning_content", None)
                            or getattr(delta, "reasoning", None)
                            or (getattr(delta, "model_extra", None) or {}).get(
                                "reasoning_content"
                            )
                            or (getattr(delta, "model_extra", None) or {}).get(
                                "reasoning"
                            )
                        )
                        c_chunk = delta.content or ""

                        if r_chunk or c_chunk:
                            tokens_count += 1
                            if not first_token:
                                ttft_ms = (now - t0) * 1000.0
                                first_token = True

                        if r_chunk:
                            thinking_count += 1
                        if c_chunk:
                            for event_type, segment in tag_parser.process_chunk(
                                c_chunk
                            ):
                                if event_type == "thinking":
                                    thinking_count += 1
                                else:
                                    content_parts.append(segment)

                    for event_type, segment in tag_parser.flush():
                        if event_type == "thinking":
                            thinking_count += 1
                        else:
                            content_parts.append(segment)

                    total_latency_ms = (time.perf_counter() - t0) * 1000.0
                    decode_sec = max((total_latency_ms - ttft_ms) / 1000.0, 0.001)
                    tps = (tokens_count - 1) / decode_sec if tokens_count > 1 else 0.0

                    return SampleResult(
                        index=idx,
                        prompt=prompt_text,
                        output="".join(content_parts),
                        ttft_ms=round(ttft_ms, 2),
                        throughput_tokens_per_sec=round(tps, 2),
                        total_latency_ms=round(total_latency_ms, 2),
                        output_tokens=tokens_count,
                        thinking_tokens=thinking_count,
                        status="success",
                    )
                except Exception as ex:
                    return SampleResult(
                        index=idx,
                        prompt=prompt_text,
                        output="",
                        ttft_ms=0.0,
                        throughput_tokens_per_sec=0.0,
                        total_latency_ms=round((time.perf_counter() - t0) * 1000.0, 2),
                        output_tokens=0,
                        thinking_tokens=0,
                        status="error",
                        error_message=str(ex),
                    )

        tasks = [
            asyncio.create_task(benchmark_single(i + 1, p))
            for i, p in enumerate(prompts)
        ]

        for completed_task in asyncio.as_completed(tasks):
            res = await completed_task
            results.append(res)
            # Yield progress event to UI
            yield f"data: {json.dumps({'type': 'sample_completed', 'result': res.model_dump(), 'completed': len(results), 'total': len(prompts)})}\n\n"

        total_elapsed = time.perf_counter() - start_time_all
        successful = [r for r in results if r.status == "success"]

        avg_ttft = (
            sum(r.ttft_ms for r in successful) / len(successful) if successful else 0.0
        )
        avg_tps = (
            sum(r.throughput_tokens_per_sec for r in successful) / len(successful)
            if successful
            else 0.0
        )
        total_tokens = sum(r.output_tokens for r in successful)
        overall_throughput = total_tokens / total_elapsed if total_elapsed > 0 else 0.0

        summary = {
            "total_samples": len(prompts),
            "successful_samples": len(successful),
            "failed_samples": len(results) - len(successful),
            "avg_ttft_ms": round(avg_ttft, 2),
            "avg_throughput_tok_per_sec": round(avg_tps, 2),
            "total_tokens_generated": total_tokens,
            "total_elapsed_sec": round(total_elapsed, 2),
            "overall_throughput_tok_per_sec": round(overall_throughput, 2),
        }

        yield f"data: {json.dumps({'type': 'batch_finished', 'summary': summary})}\n\n"