import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse

from app.routers import batch, benchmark, endpoints, templates

app = FastAPI(
    title="LLM & VLM Benchmark API",
    description="Benchmarking FastAPI service for TTFT, ITL, throughput, and reasoning across OpenAI-compatible endpoints.",
    version="1.0.0",
)

app.include_router(endpoints.router)
app.include_router(benchmark.router)
app.include_router(templates.router)
app.include_router(batch.router)

# Base directory that works both in development and inside PyInstaller bundle
if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys._MEIPASS)  # ty: ignore[unresolved-attribute]
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

STATIC_DIR = BASE_DIR / "app" / "static"
IMAGES_DIR = BASE_DIR / "Images"


@app.get("/", include_in_schema=False)
async def serve_index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/batch", include_in_schema=False)
async def serve_batch_page():
    return FileResponse(STATIC_DIR / "batch.html")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
