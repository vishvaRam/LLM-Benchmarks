from pydantic import BaseModel, Field

from app.schemas.benchmark import BenchmarkParameters


class DatasetSourceConfig(BaseModel):
    # Using Hugging Face dataset name or popular aliases
    dataset_name: str = Field(default="openai/gsm8k", example="openai/gsm8k")
    split: str = Field(default="test", example="test")
    config: str = Field(default="main", example="main")
    num_samples: int = Field(default=10, ge=1, le=200)
    prompt_column: str = Field(default="question", example="question")
    system_prompt: str | None = None


class BatchBenchmarkRequest(BaseModel):
    endpoint_id: str
    parameters: BenchmarkParameters
    concurrency_limit: int = Field(default=3, ge=1, le=32)
    dataset: DatasetSourceConfig


class SampleResult(BaseModel):
    index: int
    prompt: str
    output: str
    ttft_ms: float
    throughput_tokens_per_sec: float
    total_latency_ms: float
    output_tokens: int
    thinking_tokens: int
    status: str  # "success" | "error"
    error_message: str | None = None


class BatchAggregateSummary(BaseModel):
    total_samples: int
    successful_samples: int
    failed_samples: int
    avg_ttft_ms: float
    avg_throughput_tok_per_sec: float
    total_tokens_generated: int
    total_elapsed_sec: float
    overall_throughput_tok_per_sec: float
