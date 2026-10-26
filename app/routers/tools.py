from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.tools import ToolCallBenchmarkRequest
from app.services.tool_benchmark_service import ToolBenchmarkService

router = APIRouter(prefix="/tools-benchmark", tags=["Tool Call Benchmark"])


@router.post("/run")
async def run_tools_benchmark(request: ToolCallBenchmarkRequest):
    return StreamingResponse(
        ToolBenchmarkService.run_benchmark_stream(request),
        media_type="text/event-stream",
    )