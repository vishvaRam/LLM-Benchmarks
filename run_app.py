import multiprocessing
import socket
import sys
import tempfile
import threading
import time
import traceback
from pathlib import Path

# Required for PyInstaller frozen execution on Windows
if __name__ == "__main__":
    multiprocessing.freeze_support()

# Safe stream redirection for PyInstaller --windowed mode (where sys.stdout/stderr are None)
LOG_FILE = Path(tempfile.gettempdir()) / "inference_lab_boot.log"

class SafeStream:
    def __init__(self, fallback_path: Path):
        self.fallback_path = fallback_path

    def write(self, message: str):
        if message:
            try:
                with open(self.fallback_path, "a", encoding="utf-8") as f:
                    f.write(message)
            except Exception:
                pass

    def flush(self):
        pass

if sys.stdout is None:
    sys.stdout = SafeStream(LOG_FILE)  # type: ignore
if sys.stderr is None:
    sys.stderr = SafeStream(LOG_FILE)  # type: ignore

# Explicitly import Uvicorn protocol implementations so PyInstaller packages them reliably
try:
    import h11  # noqa: F401
    import uvicorn.lifespans.on
    import uvicorn.loops.asyncio
    import uvicorn.protocols.http.h11_impl
    import uvicorn.protocols.websockets.auto
except ImportError:
    pass

import uvicorn

from app.main import app


def get_base_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)  # type: ignore
    return Path(__file__).resolve().parent


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class UvicornServerThread(threading.Thread):
    def __init__(self, host: str, port: int):
        super().__init__(daemon=True)
        self.host = host
        self.port = port
        self.server = None
        self.error = None

    def run(self):
        try:
            config = uvicorn.Config(
                app=app,
                host=self.host,
                port=self.port,
                log_config=None,  # Crucial for --windowed mode: prevents StreamHandler crash when stdout/stderr is None
                access_log=False,
                loop="asyncio",
                http="h11",
                lifespan="on",
            )
            self.server = uvicorn.Server(config)
            self.server.run()
        except Exception as e:
            self.error = e
            tb = traceback.format_exc()
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"[ERROR] Failed to start Uvicorn server: {e}\n{tb}\n")

    def stop(self):
        if self.server:
            self.server.should_exit = True


def wait_for_server(host: str, port: int, server_thread: UvicornServerThread, timeout: float = 12.0):
    start = time.time()
    while time.time() - start < timeout:
        if not server_thread.is_alive():
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write("[ERROR] Background server thread terminated unexpectedly.\n")
            break
        try:
            with socket.create_connection((host, port), timeout=0.3):
                return True
        except (OSError, ConnectionRefusedError):
            time.sleep(0.1)
    return False


def run_pyqt6_window(url: str, icon_path: Path):
    from PyQt6.QtCore import QUrl
    from PyQt6.QtGui import QColor, QIcon, QPalette
    from PyQt6.QtWebEngineWidgets import QWebEngineView
    from PyQt6.QtWidgets import QApplication, QMainWindow

    app_qt = QApplication(sys.argv)
    app_qt.setApplicationName("Inference Lab")

    # Set dark palette for native window frame
    palette = QPalette()
    palette.setColor(QPalette.ColorRole.Window, QColor("#0b0f17"))
    app_qt.setPalette(palette)

    window = QMainWindow()
    window.setWindowTitle("Inference Lab — LLM & VLM Benchmark Studio")
    window.resize(1340, 840)
    window.setMinimumSize(1024, 680)

    if icon_path.exists():
        window.setWindowIcon(QIcon(str(icon_path)))

    web_view = QWebEngineView(window)
    web_view.page().setBackgroundColor(QColor("#0b0f17"))
    web_view.setUrl(QUrl(url))
    window.setCentralWidget(web_view)

    window.show()
    sys.exit(app_qt.exec())


def run_pywebview_window(url: str, icon_path: Path):
    import webview

    icon_str = str(icon_path) if icon_path.exists() else None
    webview.create_window(
        title="Inference Lab — LLM & VLM Benchmark Studio",
        url=url,
        width=1340,
        height=840,
        min_size=(1024, 680),
        background_color="#0b0f17",
    )
    webview.start(icon=icon_str)


def main():
    host = "127.0.0.1"
    port = find_free_port()
    base_dir = get_base_dir()
    icon_path = base_dir / "assets" / "app_icon.ico"
    if not icon_path.exists():
        icon_path = base_dir / "assets" / "app_icon.png"

    # Start FastAPI / Uvicorn server in background
    server_thread = UvicornServerThread(host, port)
    server_thread.start()

    # Wait for FastAPI server to become active
    server_ready = wait_for_server(host, port, server_thread)
    if not server_ready:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[WARN] Server was not detected on {host}:{port} within timeout.\n")

    target_url = f"http://{host}:{port}"

    # Priority 1: pywebview (Ultra-lightweight, uses native Windows Edge WebView2)
    try:
        run_pywebview_window(target_url, icon_path)
        return
    except (ImportError, Exception):
        pass

    # Priority 2: PyQt6 with QWebEngineView (if installed)
    try:
        run_pyqt6_window(target_url, icon_path)
        return
    except (ImportError, Exception):
        pass

    # Fallback: Web Browser
    import webbrowser

    webbrowser.open(target_url)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
