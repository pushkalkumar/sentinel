#!/usr/bin/env sh
# Runs the simulator beside uvicorn. Render sets $PORT; the simulator must post to that port, not 8000.
set -e
PORT="${PORT:-8000}"
export SENTINEL_BACKEND="http://127.0.0.1:${PORT}"
cd /srv/backend && uvicorn app.main:app --host 0.0.0.0 --port "$PORT" &
BACKEND_PID=$!
# Wait for the API, then keep the simulator alive for the life of the container.
i=0
until curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 || [ $i -ge 60 ]; do i=$((i+1)); sleep 1; done
(
  cd /srv/simulator
  while true; do python main.py || true; sleep 2; done
) &
wait $BACKEND_PID
