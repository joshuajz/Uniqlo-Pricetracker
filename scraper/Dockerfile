FROM ghcr.io/astral-sh/uv:0.9.11 AS uv

FROM python:3.10-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    CHROME_BINARY=/usr/bin/chromium \
    MIN_PRODUCTS=500

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        ca-certificates \
        chromium \
        chromium-driver \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=uv /uv /uvx /usr/local/bin/

WORKDIR /app

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --locked --no-dev

COPY main.py entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
