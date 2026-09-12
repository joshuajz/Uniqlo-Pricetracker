#!/bin/sh
set -eu

: "${API_URL:?API_URL must be set}"
: "${AUTH_USER:?AUTH_USER must be set}"
: "${AUTH_PASS:?AUTH_PASS must be set}"

SCRAPER_MARKET="${SCRAPER_MARKET:-canada}"

case "${SCRAPER_MARKET}" in
    canada|uk|japan|us) ;;
    *)
        echo "Unsupported SCRAPER_MARKET: ${SCRAPER_MARKET}" >&2
        exit 2
        ;;
esac

python "${SCRAPER_MARKET}/main.py"

curl --fail-with-body \
    --show-error \
    --request POST \
    --form "file=@${SCRAPER_MARKET}/output.zip" \
    --user "${AUTH_USER}:${AUTH_PASS}" \
    "${API_URL%/}/api/products/injest"
