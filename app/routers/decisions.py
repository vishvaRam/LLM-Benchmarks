import time

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.routers.templates import load_image_data_uri
from app.schemas.decision import DecisionRequest, DecisionTemplate
from app.services.benchmark_service import pdf_to_base64_images
from app.services.decision_template_store import DecisionTemplateStore
from app.services.endpoint_store import EndpointStore

router = APIRouter(prefix="/decision", tags=["Structured Decisions"])

cats_uri = load_image_data_uri("cats.jpg")
ocr_uri = load_image_data_uri("ocr.jpeg")

BUILTIN_DECISION_TEMPLATES: dict[str, DecisionTemplate] = {
    "cat_presence_choice": DecisionTemplate(
        id="cat_presence_choice",
        name="Cat Detection (Choice)",
        category="Visual Detection",
        description="Evaluates if an image contains a visible feline using binary choice probability.",
        state="Examine the image and check if it contains a cat.",
        questions={
            "is_cat": {
                "type": "choice",
                "instructions": "Determine if a cat is clearly visible in the image.",
                "criteria": {
                    "yes": "A cat is present in the frame",
                    "no": "No cat is visible",
                },
            }
        },
        sample_images=[cats_uri] if cats_uri else [],
    ),
    "document_clarity_noul": DecisionTemplate(
        id="document_clarity_noul",
        name="Document Quality (Noul)",
        category="Document Analysis",
        description="Evaluates legibility using noul probability.",
        state="Evaluate the clarity and legibility of this captured document page.",
        questions={
            "is_legible": {
                "type": "noul",
                "instructions": "Is the textual content sharp and readable without heavy blur?",
                "criteria": {
                    "true": "Text is sharp, high contrast, and legible",
                    "false": "Text is blurry, occluded, or unreadable",
                },
            }
        },
        sample_images=[ocr_uri] if ocr_uri else [],
    ),
    "scene_lighting_score": DecisionTemplate(
        id="scene_lighting_score",
        name="Lighting Assessment (Score)",
        category="Quality Assurance",
        description="Scores visual lighting quality across ordered categorical levels.",
        state="Assess the overall lighting condition and exposure of this image.",
        questions={
            "lighting_score": {
                "type": "score",
                "instructions": "Rate the overall illumination quality of the subject.",
                "criteria": [
                    "underexposed",
                    "dim",
                    "acceptable",
                    "well_lit",
                    "studio_grade",
                ],
            }
        },
        sample_images=[cats_uri] if cats_uri else [],
    ),
}


def get_all_decision_templates() -> dict[str, DecisionTemplate]:
    templates = BUILTIN_DECISION_TEMPLATES.copy()
    templates.update(DecisionTemplateStore.load_user_templates())
    return templates


@router.get("/templates", response_model=list[DecisionTemplate])
async def list_templates():
    return list(get_all_decision_templates().values())


@router.post("/templates", response_model=DecisionTemplate)
async def create_template(tpl: DecisionTemplate):
    DecisionTemplateStore.save_one(tpl)
    return tpl


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    if template_id in BUILTIN_DECISION_TEMPLATES:
        raise HTTPException(
            status_code=403, detail="Cannot delete default built-in decision presets."
        )
    success = DecisionTemplateStore.delete_one(template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": f"Preset '{template_id}' deleted successfully."}


@router.post("/process-pdf")
async def process_pdf(
    file: UploadFile = File(...),
    page_mode: str = Form("first"),
    page_limit: int = Form(1),
):
    content = await file.read()
    images = pdf_to_base64_images(content, mode=page_mode, max_pages=page_limit)
    return {"images": images, "total_processed": len(images)}


@router.post("/run")
async def run_decision(req: DecisionRequest):
    base_url = None
    api_key = "EMPTY"

    if req.endpoint_id:
        ep = EndpointStore.get(req.endpoint_id)
        if not ep:
            raise HTTPException(
                status_code=404, detail=f"Endpoint '{req.endpoint_id}' not found."
            )
        base_url = ep.base_url.rstrip("/")
        base_url = base_url.removesuffix("/v1")
        api_key = ep.api_key or "EMPTY"

    if not base_url:
        raise HTTPException(
            status_code=400, detail="A valid registered target endpoint is required."
        )

    target_url = f"{base_url}/v1/systemone"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": req.model,
        "state": req.state,
        "images": req.images,
        "questions": {k: q.model_dump() for k, q in req.questions.items()},
    }

    t0 = time.perf_counter()
    async with httpx.AsyncClient(timeout=90.0) as client:
        try:
            resp = await client.post(target_url, json=payload, headers=headers)
        except Exception as e:
            raise HTTPException(
                status_code=502, detail=f"Failed to connect to backend: {e!s}"
            )

    latency_sec = time.perf_counter() - t0

    try:
        response_json = resp.json()
    except Exception:
        response_json = {"raw_text": resp.text}

    return {
        "status_code": resp.status_code,
        "latency_sec": round(latency_sec, 3),
        "target_url": target_url,
        "data": response_json,
    }