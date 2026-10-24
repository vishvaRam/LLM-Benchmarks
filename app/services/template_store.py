import sys
from pathlib import Path

from pydantic import BaseModel

from app.schemas.template import PromptTemplate

if getattr(sys, "frozen", False):
    DATA_DIR = Path.cwd() / "data"
else:
    DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

STORAGE_FILE = DATA_DIR / "templates.json"


class TemplatesConfigFile(BaseModel):
    templates: list[PromptTemplate] = []


class TemplateStore:
    @staticmethod
    def _ensure_storage_exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if not STORAGE_FILE.exists():
            default_content = TemplatesConfigFile(templates=[])
            STORAGE_FILE.write_text(
                default_content.model_dump_json(indent=2), encoding="utf-8"
            )

    @classmethod
    def load_user_templates(cls) -> dict[str, PromptTemplate]:
        cls._ensure_storage_exists()
        try:
            raw_text = STORAGE_FILE.read_text(encoding="utf-8")
            config = TemplatesConfigFile.model_validate_json(raw_text)
            return {t.id: t for t in config.templates}
        except Exception:
            return {}

    @classmethod
    def save_all(cls, templates_map: dict[str, PromptTemplate]):
        cls._ensure_storage_exists()
        config = TemplatesConfigFile(templates=list(templates_map.values()))
        STORAGE_FILE.write_text(config.model_dump_json(indent=2), encoding="utf-8")

    @classmethod
    def save_one(cls, template: PromptTemplate):
        templates = cls.load_user_templates()
        templates[template.id] = template
        cls.save_all(templates)

    @classmethod
    def delete_one(cls, template_id: str) -> bool:
        templates = cls.load_user_templates()
        if template_id in templates:
            del templates[template_id]
            cls.save_all(templates)
            return True
        return False