from pydantic import BaseModel, Field, field_validator


class ModelInfo(BaseModel):
    id: str = Field(..., example="qwen3.8-27b-fp8")
    display_name: str | None = None
    is_vlm: bool = False
    context_window: int | None = 32768
    supports_thinking: bool = False


class EndpointRegistration(BaseModel):
    id: str = Field(..., example="vllm-local")
    name: str = Field(..., example="Local vLLM Server")
    base_url: str = Field(..., example="http://localhost:8000/v1")
    api_key: str = Field(default="empty", example="none")
    headers: dict[str, str] | None = None
    models: list[ModelInfo] = Field(default_factory=list)

    @field_validator("base_url")
    @classmethod
    def normalize_base_url(cls, v: str) -> str:
        url = (v or "").strip().rstrip("/")
        if url and not url.endswith("/v1"):
            url = f"{url}/v1"
        return url


class EndpointsConfigFile(BaseModel):
    endpoints: list[EndpointRegistration]
