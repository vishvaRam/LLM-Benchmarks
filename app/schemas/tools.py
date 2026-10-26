from typing import Any
from pydantic import BaseModel, Field

from app.schemas.benchmark import BenchmarkParameters


class ToolCallBenchmarkDatasetConfig(BaseModel):
    dataset_name: str = Field(
        default="Team-ACE/ToolACE",
        example="Team-ACE/ToolACE",
    )
    config: str = Field(default="default", example="default")
    split: str = Field(default="train", example="train")
    num_samples: int = Field(default=24, ge=1, le=200)
    shuffle: bool = True
    seed: int | None = None
    preset: str | None = None


class ToolCallBenchmarkRequest(BaseModel):
    endpoint_id: str
    parameters: BenchmarkParameters
    concurrency_limit: int = Field(default=4, ge=1, le=16)
    dataset: ToolCallBenchmarkDatasetConfig


class ToolCallSampleResult(BaseModel):
    index: int
    prompt: str
    expected_tool: str | None = None
    expected_args: dict[str, Any] | None = None
    actual_tool: str | None = None
    actual_args: dict[str, Any] | None = None
    called_tool: bool
    is_correct: bool
    ttft_ms: float
    total_latency_ms: float
    throughput_tps: float
    output_tokens: int
    raw_response: str
    status: str  # "correct" | "incorrect" | "error"
    error_message: str | None = None


class ToolCallAggregateSummary(BaseModel):
    total_samples: int
    correct_count: int
    incorrect_count: int
    error_count: int
    accuracy_pct: float
    avg_ttft_ms: float
    avg_throughput_tps: float
    total_elapsed_sec: float