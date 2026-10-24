from pydantic import BaseModel, Field, field_validator


class EndpointConfig(BaseModel):
    name: str = Field(..., example="vLLM-Local")
    base_url: str = Field(..., example="http://localhost:8000/v1")
    api_key: str = Field(default="empty", example="none")

    @field_validator("base_url")
    @classmethod
    def normalize_base_url(cls, v: str) -> str:
        url = (v or "").strip().rstrip("/")
        if url and not url.endswith("/v1"):
            url = f"{url}/v1"
        return url


class BenchmarkParameters(BaseModel):
    model: str = Field(..., example="qwen3.8-27b-fp8")
    stream: bool = True
    enable_thinking: bool = False
    thinking_budget_tokens: int | None = None
    temperature: float | None = 0.7
    top_p: float | None = 1.0
    max_tokens: int | None = 2048
    extra_body: dict | None = None


class PromptPayload(BaseModel):
    system_prompt: str | None = None
    prompt: str
    image_url: str | None = None


class BenchmarkRequest(BaseModel):
    endpoint_id: str | None = None
    endpoint: EndpointConfig | None = None
    parameters: BenchmarkParameters
    template_id: str | None = None
    template_variables: dict[str, str] | None = None
    prompt_payload: PromptPayload | None = None
    image_url: str | None = None 
    image_urls: list[str] | None = None


class BenchmarkMetrics(BaseModel):
    ttft_ms: float
    total_latency_ms: float
    inter_token_latency_avg_ms: float
    inter_token_latency_p50_ms: float
    inter_token_latency_p95_ms: float
    throughput_tokens_per_sec: float
    output_tokens: int
    thinking_tokens: int
    content_tokens: int
    finish_reason: str | None = None


class BenchmarkResponse(BaseModel):
    model: str
    endpoint_name: str
    metrics: BenchmarkMetrics
    thinking_content: str | None = None
    generated_text: str
