import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse

from app.routers import batch, benchmark, decisions, endpoints, templates, tools

app = FastAPI(
    title="LLM & VLM Benchmark API",
    description="Benchmarking FastAPI service for TTFT, ITL, throughput, and reasoning across OpenAI-compatible endpoints.",
    version="1.0.0",
)

app.include_router(endpoints.router)
app.include_router(benchmark.router)
app.include_router(templates.router)
app.include_router(decisions.router)
app.include_router(batch.router)
app.include_router(tools.router)

# Base directory that works both in development and inside PyInstaller bundle
if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys._MEIPASS)  # ty: ignore[unresolved-attribute]
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

from fastapi.staticfiles import StaticFiles

STATIC_DIR = BASE_DIR / "static"
IMAGES_DIR = BASE_DIR / "Images"
ASSETS_DIR = BASE_DIR / "assets"

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if IMAGES_DIR.exists():
    app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/", include_in_schema=False)
async def serve_index():
    return FileResponse(STATIC_DIR / "benchmark.html")


@app.get("/batch", include_in_schema=False)
async def serve_batch_page():
    return FileResponse(STATIC_DIR / "batch.html")


@app.get("/decisions")
async def decisions_page():
    return FileResponse(STATIC_DIR / "decisions.html")


@app.get("/tools")
async def serve_tools_page():
    return FileResponse(STATIC_DIR / "tools.html")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=3333, reload=True)
