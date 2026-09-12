FROM python:3.13-slim-bookworm

ARG SCRAPER_MARKET=canada

ENV PYTHONUNBUFFERED=1 \
    SCRAPER_MARKET=${SCRAPER_MARKET} \
    MIN_PRODUCTS=500 \
    SAVE_PHOTO=false

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY core.py smoke_test.py entrypoint.sh README.md ./
COPY canada ./canada
COPY uk ./uk
COPY japan ./japan
COPY us ./us
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
