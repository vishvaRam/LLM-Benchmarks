from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.batch import BatchBenchmarkRequest
from app.services.batch_service import BatchService

router = APIRouter(prefix="/batch", tags=["Batch Benchmark"])


@router.post("/run")
async def run_batch_benchmark(request: BatchBenchmarkRequest):
    return StreamingResponse(
        BatchService.run_batch_stream(request),
        media_type="text/event-stream",
    )
