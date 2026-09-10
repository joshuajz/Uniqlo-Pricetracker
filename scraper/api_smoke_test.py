"""Live smoke test for Uniqlo Canada's public storefront product API."""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request


API_BASE_URL = "https://www.uniqlo.com/ca/api/commerce/v5/en/products"
CLIENT_ID = "uq.ca.web-spa"
REQUEST_TIMEOUT_SECONDS = 30


def build_smoke_test_url():
    """Build a small request for the men's tops category."""
    query = urllib.parse.urlencode(
        {
            "path": "528,546,,",
            "genderId": "528",
            "offset": "0",
            "limit": "2",
            "rankingGender": "men",
            "rankingClassId": "546",
            "httpFailure": "true",
        }
    )
    return f"{API_BASE_URL}?{query}"


def response_excerpt(body, limit=500):
    """Return a concise single-line response excerpt for CI diagnostics."""
    return " ".join(body.split())[:limit]


def validate_payload(payload):
    """Validate the minimum response shape needed by an API-based scraper."""
    if payload.get("status") != "ok":
        raise ValueError(f"API status was not ok: {payload.get('status')!r}")

    result = payload.get("result")
    if not isinstance(result, dict):
        raise ValueError("response is missing result object")

    items = result.get("items")
    if not isinstance(items, list) or not items:
        raise ValueError("response contains no product items")

    pagination = result.get("pagination")
    if not isinstance(pagination, dict) or pagination.get("total", 0) < 1:
        raise ValueError("response is missing valid pagination")

    product = items[0]
    for field in ("productId", "name", "prices", "images"):
        if not product.get(field):
            raise ValueError(f"first product is missing {field}")

    prices = product["prices"]
    base_price = prices.get("base")
    if not isinstance(base_price, dict) or not isinstance(
        base_price.get("value"), (int, float)
    ):
        raise ValueError("first product is missing a numeric base price")

    return {
        "total_products": pagination["total"],
        "sample_product_id": product["productId"],
        "sample_name": product["name"],
        "sample_base_price": base_price["value"],
        "currency": base_price.get("currency", {}).get("code"),
    }


def main():
    request = urllib.request.Request(
        build_smoke_test_url(),
        headers={
            "Accept": "application/json",
            "Accept-Language": "en-CA,en;q=0.9",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/152.0.0.0 Safari/537.36"
            ),
            "x-fr-clientid": CLIENT_ID,
        },
    )

    try:
        with urllib.request.urlopen(
            request, timeout=REQUEST_TIMEOUT_SECONDS
        ) as response:
            status = response.status
            content_type = response.headers.get("Content-Type", "")
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        blocked = "access denied" in body.lower()
        reason = "Uniqlo/Akamai blocked this runner" if blocked else "HTTP error"
        print(
            f"FAIL: {reason}: status={exc.code}; "
            f"body={response_excerpt(body)!r}",
            file=sys.stderr,
        )
        return 1
    except urllib.error.URLError as exc:
        print(f"FAIL: API request could not connect: {exc.reason}", file=sys.stderr)
        return 1

    if status != 200:
        print(f"FAIL: unexpected HTTP status {status}", file=sys.stderr)
        return 1
    if "application/json" not in content_type.lower():
        print(
            f"FAIL: expected JSON but received {content_type!r}; "
            f"body={response_excerpt(body)!r}",
            file=sys.stderr,
        )
        return 1

    try:
        summary = validate_payload(json.loads(body))
    except (json.JSONDecodeError, ValueError) as exc:
        print(
            f"FAIL: invalid API response: {exc}; "
            f"body={response_excerpt(body)!r}",
            file=sys.stderr,
        )
        return 1

    print("PASS: Uniqlo product API is reachable and returned usable data")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
