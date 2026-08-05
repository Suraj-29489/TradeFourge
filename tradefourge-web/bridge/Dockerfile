# TradeFourge MT5 Bridge Microservice Dockerfile
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY bridge/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY bridge /app/bridge

EXPOSE 8000

CMD ["uvicorn", "bridge.main:app", "--host", "0.0.0.0", "--port", "8000"]
