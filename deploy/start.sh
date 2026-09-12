#!/usr/bin/env sh
# Runs the simulator beside uvicorn; the backend listens on $PORT (Render sets it).
set -e
cd /srv/simulator && python main.py &
cd /srv/backend && exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
