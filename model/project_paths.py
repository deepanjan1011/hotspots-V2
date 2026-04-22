from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_ROOT = REPO_ROOT / "HotSpots-AI"
SERVER_ROOT = APP_ROOT / "server"
SERVER_DATA_DIR = SERVER_ROOT / "data"
PUBLIC_DIR = APP_ROOT / "public"
MODEL_DIR = REPO_ROOT / "model"


def add_app_to_pythonpath() -> None:
    app_root = str(APP_ROOT)
    if app_root not in sys.path:
        sys.path.insert(0, app_root)
