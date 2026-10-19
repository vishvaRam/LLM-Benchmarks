# Inference Lab — LLM & VLM Benchmarking Studio

A high-performance, full-stack benchmarking and evaluation playground for Large Language Models (LLMs) and Vision-Language Models (VLMs). Designed for OpenAI-compatible inference backends such as **vLLM**, **SGLang**, **Ollama**, and **OpenAI API**.

![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12+-3776AB.svg?style=flat&logo=python&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)
![Inference](https://img.shields.io/badge/Backends-vLLM%20%7C%20SGLang%20%7C%20Ollama-7C3AED.svg?style=flat)

---

## 🚀 Key Features

### ⚡ Real-Time Streaming Performance Metrics
- **Time to First Token (TTFT)**: Precise millisecond-level calculation of prompt processing and time to first generated token.
- **Inter-Token Latency (ITL)**: Detailed latency distributions including **Average**, **P50 (Median)**, and **P95 (Spikes)**.
- **Throughput & Decode Rate**: Live generation rate in tokens/second.
- **End-to-End Latency**: Total request completion time and finish reasons.

### 🧠 Reasoning & Thinking Model Support (DeepSeek-R1 / Qwen 2.5 & 3 / vLLM)
- **vLLM `enable_thinking` Integration**: Automatic parameter injection (`chat_template_kwargs={"enable_thinking": True, "reasoning_effort": "high"}`).
- **Thinking Budget Control**: Allocate max reasoning tokens (`thinking_budget_tokens`).
- **Streaming Reasoning Extraction**: Supports both native `delta.reasoning_content` and real-time streaming tag parsing for `<think>...</think>` tags directly in content streams.
- **Interactive Reasoning Drawer**: Unfolds live reasoning trace and tracks reasoning token counts independently from response tokens.

### 🖼️ Multimodal Vision (VLM) Benchmarking
- **Drag-and-Drop / File Upload**: Converts local images to Base64 Data URIs on the fly—enabling remote inference servers (e.g. RunPod, Cloud vLLM) to process local images without network hurdles.
- **URL & Base64 Linking**: Benchmark images via public URLs or raw Data URIs.
- **VLM Presets Included**: Built-in visual spatial reasoning, multilingual document OCR, ID card data extraction, and object counting presets.

### 📊 Concurrency & Batch Evaluation (Hugging Face Datasets)
- **Zero-Dependency Dataset Loading**: Stream and evaluate rows directly from Hugging Face Datasets API (e.g., `openai/gsm8k`, `openai/openai_humaneval`, `allenai/ai2_arc`).
- **Configurable Concurrency**: Run asynchronous parallel workers (1 to 32 parallel requests) and track aggregate TTFT, cluster throughput, and per-sample latency.

### 🛠️ JSON-Backed Endpoint Management
- Persisted registry in `data/endpoints.json`.
- Manage, add, and delete endpoints directly in the UI.
- Configurable model capabilities (`supports_thinking`, `is_vlm`, `context_window`, `api_key`).

---

## 📁 Project Structure

```text
LLM-Benchmarks/
├── app/
│   ├── main.py                     # FastAPI application setup & static mounts
│   ├── routers/
│   │   ├── benchmark.py            # Single-run streaming benchmark endpoint
│   │   ├── batch.py                # Concurrent dataset batch runner
│   │   ├── endpoints.py            # Endpoint CRUD registry API
│   │   └── templates.py            # Presets & multimodal template store
│   ├── schemas/
│   │   ├── benchmark.py            # Pydantic schemas for metrics & run requests
│   │   ├── batch.py                # Batch request & aggregate metrics schemas
│   │   ├── endpoints.py            # Endpoint & model metadata schemas
│   │   └── template.py             # Prompt template schema
│   ├── services/
│   │   ├── benchmark_service.py    # OpenAI streaming client, tag parser & metrics
│   │   ├── batch_service.py        # Asynchronous batch executor with semaphore
│   │   ├── endpoint_store.py       # JSON file store for endpoints
│   │   └── metrics.py              # ITL, percentiles & throughput computation
│   └── static/
│       ├── index.html              # Main benchmark playground UI
│       ├── app.js                  # SSE stream reader & metrics dashboard
│       ├── batch.html              # Batch benchmark UI
│       └── batch.js                # Batch progress streaming & table rendering
├── data/
│   └── endpoints.json              # Configured inference endpoints
├── Images/                         # Sample multimodal test images (OCR, ID, etc.)
├── run_app.py                      # Standalone launcher with auto-browser opening
├── requirements.txt                # Python dependencies
└── README.md
```

---

## 🛠️ Installation & Setup

### 1. Prerequisites
- Python 3.12+
- [`uv`](https://github.com/astral-sh/uv) (recommended) or `pip`

### 2. Install Dependencies

Using `uv`:
```bash
uv sync
```

Or using `pip`:
```bash
python -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

---

## 🏃 Running the Application

### Development Mode (with Hot Reload):
```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Standalone Desktop Launcher:
Runs the server and automatically opens your browser at `http://127.0.0.1:8000`:
```bash
uv run python run_app.py
```

---

## 📦 Building a Single-File Standalone Executable

You can bundle this application into a standalone binary using PyInstaller.

### On Linux / macOS (ELF Binary):
```bash
uv run pyinstaller --noconfirm --onefile \
  --name "LLM_Benchmarking_Studio" \
  --distpath "releases" \
  --add-data "$(pwd)/app/static:app/static" \
  --add-data "$(pwd)/Images:Images" \
  --add-data "$(pwd)/data:data" \
  --hidden-import "uvicorn.logging" \
  --hidden-import "uvicorn.loops" \
  --hidden-import "uvicorn.loops.auto" \
  --hidden-import "uvicorn.protocols" \
  --hidden-import "uvicorn.protocols.http" \
  --hidden-import "uvicorn.protocols.http.auto" \
  --hidden-import "uvicorn.protocols.websockets" \
  --hidden-import "uvicorn.protocols.websockets.auto" \
  --hidden-import "uvicorn.lifespans" \
  --hidden-import "uvicorn.lifespans.on" \
  --hidden-import "openai" \
  --hidden-import "httpx" \
  --hidden-import "pydantic" \
  --hidden-import "fastapi" \
  --hidden-import "starlette.staticfiles" \
  run_app.py
```

### On Windows PowerShell (Single `.exe` File):
```powershell
uv run pyinstaller --noconfirm --onefile `
  --name "LLM_Benchmarking_Studio" `
  --distpath "releases" `
  --add-data "$((Get-Location).Path)\app\static;app/static" `
  --add-data "$((Get-Location).Path)\Images;Images" `
  --add-data "$((Get-Location).Path)\data;data" `
  --hidden-import "uvicorn.logging" `
  --hidden-import "uvicorn.loops" `
  --hidden-import "uvicorn.loops.auto" `
  --hidden-import "uvicorn.protocols" `
  --hidden-import "uvicorn.protocols.http" `
  --hidden-import "uvicorn.protocols.http.auto" `
  --hidden-import "uvicorn.protocols.websockets" `
  --hidden-import "uvicorn.protocols.websockets.auto" `
  --hidden-import "uvicorn.lifespans" `
  --hidden-import "uvicorn.lifespans.on" `
  --hidden-import "openai" `
  --hidden-import "httpx" `
  --hidden-import "pydantic" `
  --hidden-import "fastapi" `
  --hidden-import "starlette.staticfiles" `
  run_app.py
```

The output executable will be created in the `releases/` directory.

---

## 📡 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | Main benchmarking playground UI |
| `/batch` | `GET` | Batch evaluation dashboard UI |
| `/benchmark/run` | `POST` | Executes streaming single benchmark via Server-Sent Events (SSE) |
| `/batch/run` | `POST` | Executes concurrent dataset benchmark with live SSE progress |
| `/endpoints/` | `GET`, `POST`, `DELETE` | List, save, or delete configured endpoints |
| `/endpoints/{id}` | `GET`, `DELETE` | Retrieve or delete specific endpoint by ID |
| `/templates/` | `GET`, `POST`, `DELETE` | List or register benchmark prompt templates |
| `/health` | `GET` | Health check endpoint |

---

## 📄 License
This project is open-source and available under the **MIT License**.
