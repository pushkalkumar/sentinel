PY=backend/.venv/bin/python
UVICORN=backend/.venv/bin/uvicorn
.PHONY: install backend sim frontend dev seed build smoke clean bridge
install:      ; uv pip install --python $(PY) -r backend/requirements.txt -r simulator/requirements.txt && cd frontend && npm ci
backend:      ; cd backend && ../$(UVICORN) app.main:app --host 0.0.0.0 --port 8000 --reload
sim:          ; cd simulator && ../$(PY) main.py
frontend:     ; cd frontend && npm run dev -- --host 0.0.0.0 --port 5173
dev:          ; ./scripts/dev.sh
seed:         ; cd backend && SENTINEL_RESET_DB=1 ../$(PY) -m app.seed
build:        ; cd frontend && npm run build
smoke:        ; ./scripts/smoke.sh
clean:        ; rm -f backend/sentinel.db backend/sentinel.db-wal backend/sentinel.db-shm
bridge:       ; cd backend && ../$(PY) -m app.hardware_bridge $(if $(PORT),--port $(PORT),)
