#!/usr/bin/env bash
# Start the FastAPI dev server. Prefers a venv next to this file (.venv, then venv).
set -euo pipefail
cd "$(dirname "$0")"
if [[ -x .venv/bin/python ]]; then
  exec .venv/bin/python -m uvicorn main:app --reload --port 8000
fi
if [[ -x venv/bin/python ]]; then
  exec venv/bin/python -m uvicorn main:app --reload --port 8000
fi
exec python3 -m uvicorn main:app --reload --port 8000
