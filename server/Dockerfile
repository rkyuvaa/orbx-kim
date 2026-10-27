FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=300 \
    UV_SYSTEM_PYTHON=1

WORKDIR /app

# 1. Install uv for ultra-fast parallel package installation (~3s vs 4+ mins with standard pip)
RUN pip install --no-cache-dir uv

# 2. Install dependencies first for maximum Docker layer caching
COPY requirements.txt ./
RUN uv pip install --no-cache -r requirements.txt

# 3. Copy application source code
COPY pyproject.toml ./
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic
COPY scripts ./scripts

# 4. Install local package in editable mode (runs in 0.1s, no network access needed)
RUN uv pip install --no-cache --no-deps -e .

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && python -m scripts.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-4} --proxy-headers --forwarded-allow-ips='*'"]
