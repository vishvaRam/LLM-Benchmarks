import sys
from pathlib import Path

from app.schemas.endpoints import EndpointRegistration, EndpointsConfigFile

if getattr(sys, "frozen", False):
    DATA_DIR = Path.cwd() / "data"
else:
    DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

STORAGE_FILE = DATA_DIR / "endpoints.json"


class EndpointStore:
    @staticmethod
    def _ensure_storage_exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if not STORAGE_FILE.exists():
            default_content = EndpointsConfigFile(
                endpoints=[
                    EndpointRegistration(
                        id="vllm-local",
                        name="Local vLLM",
                        base_url="http://localhost:8000/v1",
                        api_key="dummy",
                        models=[],
                    )
                ]
            )
            STORAGE_FILE.write_text(
                default_content.model_dump_json(indent=2), encoding="utf-8"
            )

    @classmethod
    def load_all(cls) -> dict[str, EndpointRegistration]:
        cls._ensure_storage_exists()
        try:
            raw_text = STORAGE_FILE.read_text(encoding="utf-8")
            config = EndpointsConfigFile.model_validate_json(raw_text)
            return {ep.id: ep for ep in config.endpoints}
        except Exception:
            return {}

    @classmethod
    def save_all(cls, endpoints_map: dict[str, EndpointRegistration]):
        cls._ensure_storage_exists()
        config = EndpointsConfigFile(endpoints=list(endpoints_map.values()))
        STORAGE_FILE.write_text(config.model_dump_json(indent=2), encoding="utf-8")

    @classmethod
    def get(cls, endpoint_id: str) -> EndpointRegistration | None:
        endpoints = cls.load_all()
        return endpoints.get(endpoint_id)

    @classmethod
    def save_one(cls, endpoint: EndpointRegistration):
        endpoints = cls.load_all()
        endpoints[endpoint.id] = endpoint
        cls.save_all(endpoints)

    @classmethod
    def delete_one(cls, endpoint_id: str) -> bool:
        endpoints = cls.load_all()
        if endpoint_id in endpoints:
            del endpoints[endpoint_id]
            cls.save_all(endpoints)
            return True
        return False
