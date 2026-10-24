from pydantic import BaseModel, Field


class PromptTemplate(BaseModel):
    id: str
    category: str
    name: str
    description: str | None = None
    system_prompt: str | None = None
    template: str
    default_variables: dict[str, str] = Field(default_factory=dict)
    sample_image_url: str | None = None
    sample_images: list[str] | None = None
