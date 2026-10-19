# Inference Lab — LLM & VLM Benchmarking Studio

A high-performance, full-stack benchmarking and evaluation playground for Large Language Models (LLMs) and Vision-Language Models (VLMs). Designed for OpenAI-compatible inference backends such as **vLLM**, **SGLang**, **Ollama**, and **OpenAI API**.

![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12+-3776AB.svg?style=flat&logo=python&logoColor=white)
![Platform](<https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20(Ubuntu)-blue.svg?style=flat>)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)
![Inference](<https://img.shields.io/badge/Backends-vLLM%20%7C%20SGLang%20%7C%20Ollama-7C3AED.svg?style=flat>)

---

## 🖥️ Cross-Platform Native Desktop Support

Inference Lab is designed to run seamlessly across platforms:

- **Windows**: Uses native Edge WebView2 runtime out of the box for an ultra-lightweight, zero-overhead desktop window.
- **Linux (Ubuntu / Debian)**: Integrates with system WebKitGTK (`gir1.2-webkit2-4.1`) for native window rendering without bundling heavy Chromium runtimes.
- **Web Browser Fallback**: Gracefully opens in your default browser if native window libraries are unavailable.

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
├── run_app.py                      # Standalone native desktop launcher
├── requirements.txt                # Python dependencies
├── generate_app_icon.py            # App icon generator for release builds
└── README.md
```

---

## 🛠️ Installation & Setup

### 1. Prerequisites

- Python 3.12+
- [`uv`](https://github.com/astral-sh/uv) (recommended) or `pip`

#### Native Desktop Window Requirements (by OS):

- **Windows**: Uses Microsoft Edge WebView2 (pre-installed on Windows 10 & 11).
- **Linux (Ubuntu / Debian)**: Requires system WebKitGTK and PyGObject libraries for native window rendering:
  ```bash
  sudo apt update
  sudo apt install -y python3-gi gir1.2-gtk-3.0 gir1.2-webkit2-4.1
  ```

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

# On Linux, install PyGObject for native window support:
pip install PyGObject
```

---

## 🏃 Running the Application

### Development Mode (with Hot Reload):

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 3333 --reload
```

### Standalone Desktop Launcher:

Runs the local server on a dynamic free port and opens a native desktop application window:

```bash
uv run run_app.py
```

---

## 📦 Packaging & Standalone Release Builds

Inference Lab can be packaged into standalone native desktop releases for both **Windows (.exe)** and **Linux (.deb)**.

### 🪟 Windows (.exe)

Build a single-file executable using PyInstaller:

#### Single-Line Command:

```bash
pyinstaller --noconfirm --onefile --windowed \
  --name "LLM_Benchmarking_Studio_v1.0.0" \
  --distpath "releases" \
  --icon "assets/app_icon.ico" \
  --add-data "app/static;app/static" \
  --add-data "Images;Images" \
  --add-data "data;data" \
  --add-data "assets;assets" \
  --collect-all "uvicorn" \
  --collect-all "fastapi" \
  --collect-all "starlette" \
  --collect-all "webview" \
  run_app.py
```

#### Multi-Line (PowerShell):

```powershell
pyinstaller --noconfirm --onefile --windowed `
  --name "LLM_Benchmarking_Studio_v1.0.0" `
  --distpath "releases" `
  --icon "assets/app_icon.ico" `
  --add-data "app/static;app/static" `
  --add-data "Images;Images" `
  --add-data "data;data" `
  --add-data "assets;assets" `
  --collect-all "uvicorn" `
  --collect-all "fastapi" `
  --collect-all "starlette" `
  --collect-all "webview" `
  run_app.py
```

The output `.exe` will be generated in `releases/`.

---

### 🐧 Linux / Ubuntu (.deb Package)

#### 1. Build the Debian package:

Ensure `scripts/build_deb.sh` is executable and run the build script:

```bash
chmod +x scripts/build_deb.sh
./scripts/build_deb.sh
```

This freezes the application, bundles all static assets, and builds a Debian `.deb` package with desktop integration and icon registration.

The output package will be created at:
`releases/llm-benchmarking-studio_1.0.0_amd64.deb`

#### 2. Install the `.deb` package on Ubuntu / Debian:

Install using `apt` so all required system runtime dependencies (WebKitGTK) are automatically resolved:

```bash
sudo apt install ./releases/llm-benchmarking-studio_1.0.0_amd64.deb
```

*(Alternative using dpkg)*:

```bash
sudo dpkg -i releases/llm-benchmarking-studio_1.0.0_amd64.deb
sudo apt-get install -f
```

#### 3. Launching the App:

- Launch directly from your application launcher / desktop menu (**LLM Benchmarking Studio**)
- Or from any terminal:
  ```bash
  llm-benchmarking-studio
  ```

#### To Uninstall:

```bash
sudo apt remove llm-benchmarking-studio
```

---

## 📡 API Reference

| Endpoint            | Method                        | Description                                                      |
| :------------------ | :---------------------------- | :--------------------------------------------------------------- |
| `/`               | `GET`                       | Main benchmarking playground UI                                  |
| `/batch`          | `GET`                       | Batch evaluation dashboard UI                                    |
| `/benchmark/run`  | `POST`                      | Executes streaming single benchmark via Server-Sent Events (SSE) |
| `/batch/run`      | `POST`                      | Executes concurrent dataset benchmark with live SSE progress     |
| `/endpoints/`     | `GET`, `POST`, `DELETE` | List, save, or delete configured endpoints                       |
| `/endpoints/{id}` | `GET`, `DELETE`           | Retrieve or delete specific endpoint by ID                       |
| `/templates/`     | `GET`, `POST`, `DELETE` | List or register benchmark prompt templates                      |
| `/health`         | `GET`                       | Health check endpoint                                            |

---

## 📄 License

This project is open-source and available under the **MIT License**.
