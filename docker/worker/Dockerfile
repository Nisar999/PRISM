FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY prism/ ./prism/
RUN pip install --no-cache-dir .

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD celery -A prism.worker.celery_app inspect ping -d celery@$HOSTNAME || exit 1

CMD ["celery", "-A", "prism.worker.celery_app", "worker", "--loglevel=info", "--concurrency=2"]
