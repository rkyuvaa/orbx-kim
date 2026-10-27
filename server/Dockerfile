FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1 \
    UV_HTTP_TIMEOUT=15 \
    UV_HTTP_RETRIES=2 \
    UV_CONCURRENT_DOWNLOADS=4

WORKDIR /app

# Prefer IPv4 over IPv6 to eliminate 10+ minute socket timeouts on hosts with broken IPv6 routing
RUN echo "precedence ::ffff:0:0/96 100" >> /etc/gai.conf

# Copy standalone uv binary directly from official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# 1. Install dependencies first for maximum Docker layer caching
COPY requirements.txt ./
ARG UV_INDEX_URL=https://pypi.org/simple
# Use BuildKit cache mount so wheels are cached on host across builds instead of redownloaded
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --index-url "${UV_INDEX_URL}" -r requirements.txt

# 2. Copy application source code
COPY pyproject.toml ./
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic
COPY scripts ./scripts

# 3. Install local package in editable mode (runs in 0.1s, no network access needed)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --no-deps -e .

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && python -m scripts.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-4} --proxy-headers --forwarded-allow-ips='*'"]
