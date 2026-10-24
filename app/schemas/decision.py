from typing import Any

from pydantic import BaseModel, Field


class DecisionQuestion(BaseModel):
    type: str = Field(..., description="'choice', 'noul', or 'score'")
    instructions: str
    criteria: Any = None  # Dict for choice/noul, list for score


class DecisionRequest(BaseModel):
    endpoint_id: str | None = None
    model: str
    state: str
    images: list[str] = Field(default_factory=list)
    questions: dict[str, DecisionQuestion]


class DecisionTemplate(BaseModel):
    id: str
    name: str
    category: str = "General"
    description: str | None = None
    state: str
    questions: dict[str, Any]
    sample_images: list[str] | None = None


class DecisionTemplatesConfigFile(BaseModel):
    templates: list[DecisionTemplate] = Field(default_factory=list)