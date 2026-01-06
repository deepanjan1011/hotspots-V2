#!/bin/bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m gunicorn --bind=0.0.0.0:8000 --timeout 600 -w 4 -k uvicorn.workers.UvicornWorker main:app
