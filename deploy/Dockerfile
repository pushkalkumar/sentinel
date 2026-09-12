# Backend + simulator in one container (free-tier hosts allow one web service).
FROM python:3.13-slim
WORKDIR /srv
COPY backend/requirements.txt backend/requirements.txt
COPY simulator/requirements.txt simulator/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt -r simulator/requirements.txt
COPY shared shared
COPY backend backend
COPY simulator simulator
COPY deploy/start.sh deploy/start.sh
RUN chmod +x deploy/start.sh
ENV SENTINEL_DB=sqlite+aiosqlite:////tmp/sentinel.db \
    SENTINEL_SIM_URL=http://127.0.0.1:8001 \
    SENTINEL_BACKEND=http://127.0.0.1:8000 \
    SENTINEL_SIM_KEY=sentinel-sim \
    SIM_CONTROL_PORT=8001 \
    PORT=8000
EXPOSE 8000
CMD ["deploy/start.sh"]
