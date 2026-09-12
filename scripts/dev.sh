#!/usr/bin/env bash
# Starts backend, simulator and frontend; Ctrl-C stops all three.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
PY="$ROOT/backend/.venv/bin/python"
UVICORN="$ROOT/backend/.venv/bin/uvicorn"
PIDS=()

cleanup() {
  echo; echo "[dev] stopping"
  for pid in "${PIDS[@]:-}"; do [ -n "$pid" ] && kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

prefix() { sed -u "s/^/[$1] /" 2>/dev/null || sed -l "s/^/[$1] /"; }

(cd backend && "$UVICORN" app.main:app --host 0.0.0.0 --port 8000 --reload 2>&1 | prefix be) &
PIDS+=($!)

echo "[dev] waiting for backend /api/health"
for _ in $(seq 1 60); do
  if curl -sf http://localhost:8000/api/health >/dev/null 2>&1; then break; fi
  sleep 0.5
done
curl -sf http://localhost:8000/api/health >/dev/null || { echo "[dev] backend did not come up"; exit 1; }

(cd simulator && "$PY" main.py 2>&1 | prefix sim) &
PIDS+=($!)

(cd frontend && npm run dev -- --host 0.0.0.0 --port 5173 2>&1 | prefix fe) &
PIDS+=($!)

wait
