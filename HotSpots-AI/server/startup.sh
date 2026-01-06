#!/bin/bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
