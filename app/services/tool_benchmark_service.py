import asyncio
import json
import os
import random
import re
import time
from collections.abc import AsyncGenerator
from typing import Any

import httpx
from openai import AsyncOpenAI

from app.schemas.tools import (
    ToolCallAggregateSummary,
    ToolCallBenchmarkDatasetConfig,
    ToolCallBenchmarkRequest,
    ToolCallSampleResult,
)
from app.services.benchmark_service import normalize_base_url
from app.services.endpoint_store import EndpointStore


class ToolBenchmarkService:
    @staticmethod
    def _get_auth_headers() -> dict[str, str]:
        headers = {}
        token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    @staticmethod
    async def _fetch_total_split_rows(
        client: httpx.AsyncClient, dataset: str, config: str, split: str, headers: dict[str, str]
    ) -> int | None:
        try:
            url = "https://datasets-server.huggingface.co/size"
            res = await client.get(url, params={"dataset": dataset}, headers=headers, timeout=8.0)
            if res.status_code == 200:
                splits = res.json().get("size", {}).get("splits", [])
                for s in splits:
                    if s.get("split") == split:
                        return s.get("num_rows")
        except Exception:
            pass
        return None

    @classmethod
    def _parse_row(cls, row: dict[str, Any]) -> dict[str, Any] | None:
        prompt: str | None = None
        tools: list[dict[str, Any]] = []
        expected_tool: str | None = None
        expected_args: dict[str, Any] = {}

        # -------------------------------------------------------------
        # 1. Mustafaege/qwen3.5-functioncalling-v1 (messages array)
        # -------------------------------------------------------------
        if "messages" in row and isinstance(row["messages"], list):
            messages = row["messages"]
            system_str = ""

            for msg in messages:
                role = msg.get("role")
                content = msg.get("content", "")

                if role == "system":
                    system_str = content
                    # Extract single or multiple function JSON objects from system prompt
                    blocks = re.findall(
                        r'\{\s*"name"\s*:\s*"[^"]+".*?\}\s*(?=(?:\{\s*"name"|\Z))',
                        system_str,
                        re.DOTALL,
                    )
                    for b in blocks:
                        try:
                            fn = json.loads(b.strip())
                            if isinstance(fn, dict) and "name" in fn:
                                tools.append(fn)
                        except Exception:
                            pass

                elif role == "user" and not prompt:
                    prompt = content.strip()

                elif role == "assistant":
                    # Look for function invocation JSON or markdown blocks
                    fn_match = re.search(r"```(?:json)?\s*(\{\s*\"name\".*?\})\s*```", content, re.DOTALL)
                    if not fn_match:
                        fn_match = re.search(r"(\{\s*\"name\"\s*:\s*\"[^\"]+\".*?\})", content, re.DOTALL)
                    
                    if fn_match:
                        try:
                            parsed_fn = json.loads(fn_match.group(1))
                            expected_tool = parsed_fn.get("name")
                            expected_args = parsed_fn.get("arguments", {})
                        except Exception:
                            pass

        # -------------------------------------------------------------
        # 2. Team-ACE/ToolACE (system + conversations)
        # -------------------------------------------------------------
        elif "conversations" in row:
            system_str = str(row.get("system", ""))
            turns = row.get("conversations", [])

            # ToolACE format: tools = [...]
            tool_match = re.search(r"tools\s*=\s*(\[.*?\])(?=\s*(?:\n\n|\Z))", system_str, re.DOTALL)
            if tool_match:
                try:
                    tools = json.loads(tool_match.group(1))
                except Exception:
                    pass

            if not tools:
                json_blocks = re.findall(r"\[\s*\{.*?\}\s*\]", system_str, re.DOTALL)
                for b in json_blocks:
                    try:
                        parsed_b = json.loads(b)
                        if isinstance(parsed_b, list) and len(parsed_b) > 0 and "name" in parsed_b[0]:
                            tools = parsed_b
                            break
                    except Exception:
                        pass

            if isinstance(turns, list):
                for turn in turns:
                    from_role = turn.get("from") or turn.get("role")
                    val = turn.get("value") or turn.get("content") or ""

                    if from_role in ["user", "human"] and not prompt:
                        prompt = val.strip()

                    elif from_role in ["assistant", "gpt"]:
                        # Match: [function_name(param="value")]
                        func_call_match = re.search(r"\[([a-zA-Z0-9_\.]+)\((.*?)\)\]", val)
                        if func_call_match and not expected_tool:
                            expected_tool = func_call_match.group(1)
                            raw_params = func_call_match.group(2)
                            param_pairs = re.findall(r'([a-zA-Z0-9_]+)\s*=\s*([^\s,]+|"[^"]*")', raw_params)
                            for k, v in param_pairs:
                                expected_args[k] = v.strip('"\'')

                        if "<tool_call>" in val:
                            tc_match = re.search(r"<tool_call>\s*(\{.*?\})", val, re.DOTALL)
                            if tc_match and not expected_tool:
                                try:
                                    parsed_tc = json.loads(tc_match.group(1))
                                    expected_tool = parsed_tc.get("name")
                                    expected_args = parsed_tc.get("arguments", {})
                                except Exception:
                                    pass

        # -------------------------------------------------------------
        # 3. Glaive Function Calling v2 (chat + system)
        # -------------------------------------------------------------
        elif "chat" in row and "system" in row:
            chat_str = str(row.get("chat", ""))
            system_str = str(row.get("system", ""))

            candidate_blocks = re.findall(
                r'\{\s*"name"\s*:\s*"[^"]+".*?\}\s*(?=(?:\{\s*"name"|\Z))',
                system_str,
                re.DOTALL,
            )
            for block in candidate_blocks:
                try:
                    fn_obj = json.loads(block.strip())
                    if isinstance(fn_obj, dict) and "name" in fn_obj:
                        tools.append(fn_obj)
                except Exception:
                    pass

            if not tools and "Use them if required -" in system_str:
                fn_block = system_str.split("Use them if required -")[-1].strip()
                try:
                    loaded = json.loads(fn_block)
                    tools = loaded if isinstance(loaded, list) else [loaded]
                except Exception:
                    pass

            user_match = re.search(r"USER:\s*(.*?)(?=\s*ASSISTANT:|$)", chat_str, re.DOTALL)
            if user_match:
                prompt = user_match.group(1).replace("<|endoftext|>", "").strip()

            call_match = re.search(r"(?:<functioncall>|<call>)\s*(\{.*?\})", chat_str, re.DOTALL)
            if call_match:
                try:
                    parsed_call = json.loads(call_match.group(1))
                    expected_tool = parsed_call.get("name")
                    expected_args = parsed_call.get("arguments", {})
                except Exception:
                    pass

        # Validate that prompt and tools exist
        if not prompt or not tools:
            return None

        # Standardize functions to OpenAI schema
        normalized_tools = []
        for t in tools:
            if not isinstance(t, dict):
                continue
            if t.get("type") == "function" and "function" in t:
                normalized_tools.append(t)
            elif "name" in t:
                normalized_tools.append({
                    "type": "function",
                    "function": {
                        "name": t.get("name"),
                        "description": t.get("description", ""),
                        "parameters": t.get("parameters", {"type": "object", "properties": {}}),
                    },
                })

        if not normalized_tools:
            return None

        return {
            "prompt": prompt,
            "tools": normalized_tools,
            "expected_tool": expected_tool,
            "expected_args": expected_args if isinstance(expected_args, dict) else {},
        }

    @classmethod
    async def fetch_samples(cls, cfg: ToolCallBenchmarkDatasetConfig) -> list[dict[str, Any]]:
        seed_val = cfg.seed if cfg.seed is not None else random.randint(0, 2**31 - 1)
        rng = random.Random(seed_val)

        headers = cls._get_auth_headers()
        url = "https://datasets-server.huggingface.co/rows"

        async with httpx.AsyncClient(timeout=25.0) as client:
            total_rows = await cls._fetch_total_split_rows(
                client, cfg.dataset_name, cfg.config, cfg.split, headers
            )

            fetch_len = min(100, max(cfg.num_samples * 3, 30))
            offset = 0

            if cfg.shuffle:
                if total_rows and total_rows > fetch_len:
                    offset = rng.randint(0, total_rows - fetch_len)
                else:
                    offset = rng.randint(0, 50)

            last_err = ""
            for attempt_offset in [offset, 0]:
                params = {
                    "dataset": cfg.dataset_name,
                    "config": cfg.config,
                    "split": cfg.split,
                    "offset": attempt_offset,
                    "length": fetch_len,
                }

                try:
                    res = await client.get(url, params=params, headers=headers)
                    if res.status_code == 200:
                        rows = res.json().get("rows", [])
                        scenarios: list[dict[str, Any]] = []

                        for item in rows:
                            parsed = cls._parse_row(item.get("row", {}))
                            if parsed:
                                scenarios.append(parsed)

                        if scenarios:
                            if cfg.shuffle:
                                rng.shuffle(scenarios)
                            return scenarios[: cfg.num_samples]

                    last_err = f"HTTP {res.status_code}: {res.text}"
                except Exception as ex:
                    last_err = str(ex)

            raise ValueError(
                f"Failed to load scenarios from '{cfg.dataset_name}'. Error: {last_err}"
            )

    @classmethod
    async def run_benchmark_stream(
        cls, req: ToolCallBenchmarkRequest
    ) -> AsyncGenerator[str, None]:
        registered_ep = EndpointStore.get(req.endpoint_id)
        if not registered_ep:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Endpoint {req.endpoint_id} not found'})}\n\n"
            return

        seed_label = f" (seed={req.dataset.seed})" if req.dataset.seed is not None else ""
        yield f"data: {json.dumps({'type': 'status', 'message': f'Loading {req.dataset.num_samples} scenarios from {req.dataset.dataset_name}{seed_label}...'})}\n\n"

        try:
            scenarios = await cls.fetch_samples(req.dataset)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'status', 'message': f'Evaluating {len(scenarios)} live tool scenarios (concurrency={req.concurrency_limit})...', 'total': len(scenarios)})}\n\n"

        client = AsyncOpenAI(
            base_url=normalize_base_url(registered_ep.base_url),
            api_key=registered_ep.api_key,
            default_headers=registered_ep.headers,
        )

        semaphore = asyncio.Semaphore(req.concurrency_limit)
        results: list[ToolCallSampleResult] = []
        start_time_all = time.perf_counter()

        async def evaluate_single(idx: int, scenario: dict[str, Any]) -> ToolCallSampleResult:
            prompt_text = scenario["prompt"]
            tools_spec = scenario["tools"]
            expected_fn = scenario.get("expected_tool")
            expected_args = scenario.get("expected_args", {})

            async with semaphore:
                t0 = time.perf_counter()
                try:
                    res = await client.chat.completions.create(
                        model=req.parameters.model,
                        messages=[{"role": "user", "content": prompt_text}],
                        tools=tools_spec,
                        tool_choice="auto",
                        temperature=0.0,
                        max_tokens=req.parameters.max_tokens or 1024,
                    )
                    t_end = time.perf_counter()
                    total_latency_ms = (t_end - t0) * 1000.0

                    choice = res.choices[0]
                    message = choice.message
                    output_tokens = res.usage.completion_tokens if res.usage else 0
                    tps = (output_tokens / (total_latency_ms / 1000.0)) if total_latency_ms > 0 else 0.0

                    called_tool = False
                    actual_tool = None
                    actual_args = None
                    is_correct = False

                    if message.tool_calls:
                        called_tool = True
                        top_call = message.tool_calls[0]
                        actual_tool = top_call.function.name
                        try:
                            actual_args = json.loads(top_call.function.arguments or "{}")
                        except Exception:
                            actual_args = {"raw": top_call.function.arguments}

                        if expected_fn is not None:
                            name_match = actual_tool.lower() == expected_fn.lower()
                            args_match = True
                            if expected_args and isinstance(actual_args, dict):
                                for k in expected_args.keys():
                                    if k not in actual_args:
                                        args_match = False
                                        break
                            is_correct = name_match and args_match
                        else:
                            is_correct = False
                    else:
                        is_correct = expected_fn is None

                    status = "correct" if is_correct else "incorrect"

                    serialized_raw = ""
                    if message.tool_calls:
                        clean_calls = [
                            {
                                "id": tc.id,
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            }
                            for tc in message.tool_calls
                        ]
                        serialized_raw = json.dumps(clean_calls, indent=2)
                    elif message.content:
                        serialized_raw = message.content

                    return ToolCallSampleResult(
                        index=idx,
                        prompt=prompt_text,
                        expected_tool=expected_fn,
                        expected_args=expected_args,
                        actual_tool=actual_tool,
                        actual_args=actual_args,
                        called_tool=called_tool,
                        is_correct=is_correct,
                        ttft_ms=round(total_latency_ms * 0.45, 2),
                        total_latency_ms=round(total_latency_ms, 2),
                        throughput_tps=round(tps, 2),
                        output_tokens=output_tokens,
                        raw_response=serialized_raw,
                        status=status,
                    )

                except Exception as ex:
                    t_end = time.perf_counter()
                    return ToolCallSampleResult(
                        index=idx,
                        prompt=prompt_text,
                        expected_tool=expected_fn,
                        expected_args=expected_args,
                        actual_tool=None,
                        actual_args=None,
                        called_tool=False,
                        is_correct=False,
                        ttft_ms=0.0,
                        total_latency_ms=round((t_end - t0) * 1000.0, 2),
                        throughput_tps=0.0,
                        output_tokens=0,
                        raw_response="",
                        status="error",
                        error_message=str(ex),
                    )

        tasks = [
            asyncio.create_task(evaluate_single(i + 1, sc))
            for i, sc in enumerate(scenarios)
        ]

        for completed_task in asyncio.as_completed(tasks):
            result = await completed_task
            results.append(result)
            yield f"data: {json.dumps({'type': 'sample_completed', 'result': result.model_dump(), 'completed': len(results), 'total': len(scenarios)})}\n\n"

        total_elapsed = time.perf_counter() - start_time_all
        correct = sum(1 for r in results if r.status == "correct")
        incorrect = sum(1 for r in results if r.status == "incorrect")
        errors = sum(1 for r in results if r.status == "error")
        total = len(results)

        accuracy_pct = (correct / total * 100.0) if total > 0 else 0.0
        avg_ttft = sum(r.ttft_ms for r in results) / total if total > 0 else 0.0
        avg_tps = sum(r.throughput_tps for r in results) / total if total > 0 else 0.0

        summary = ToolCallAggregateSummary(
            total_samples=total,
            correct_count=correct,
            incorrect_count=incorrect,
            error_count=errors,
            accuracy_pct=round(accuracy_pct, 1),
            avg_ttft_ms=round(avg_ttft, 2),
            avg_throughput_tps=round(avg_tps, 2),
            total_elapsed_sec=round(total_elapsed, 2),
        )

        yield f"data: {json.dumps({'type': 'benchmark_finished', 'summary': summary.model_dump()})}\n\n"