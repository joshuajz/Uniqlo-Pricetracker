#!/bin/sh
set -eu

: "${API_URL:?API_URL must be set}"
: "${AUTH_USER:?AUTH_USER must be set}"
: "${AUTH_PASS:?AUTH_PASS must be set}"

uv run --no-sync main.py

curl --fail-with-body \
    --show-error \
    --request POST \
    --form "file=@output.zip" \
    --user "${AUTH_USER}:${AUTH_PASS}" \
    "${API_URL%/}/api/products/injest"
