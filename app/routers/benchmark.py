from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.benchmark import BenchmarkRequest
from app.services.benchmark_service import BenchmarkService

router = APIRouter(prefix="/benchmark", tags=["Benchmark"])


@router.post("/run")
async def run_benchmark(request: BenchmarkRequest):
    return StreamingResponse(
        BenchmarkService.stream_benchmark(request),
        media_type="text/event-stream",
    )
