from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import StreamingResponse

from app.schemas.benchmark import BenchmarkRequest
from app.services.benchmark_service import BenchmarkService, pdf_to_base64_images

router = APIRouter(prefix="/benchmark", tags=["Benchmark"])


@router.post("/run")
async def run_benchmark(request: BenchmarkRequest):
    return StreamingResponse(
        BenchmarkService.stream_benchmark(request),
        media_type="text/event-stream",
    )


@router.post("/process-pdf")
async def process_pdf(
    file: UploadFile = File(...),  # noqa: B008
    page_mode: str = Form("first"),  # "first", "all", "limit"
    page_limit: int = Form(1),
):
    content = await file.read()
    images = pdf_to_base64_images(content, mode=page_mode, max_pages=page_limit)
    return {"images": images, "total_processed": len(images)}