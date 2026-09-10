"""Uniqlo Canada price scraper backed by the public storefront JSON API."""

from __future__ import annotations

import json
import os
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


SITE_BASE_URL = "https://www.uniqlo.com/ca/en"
API_BASE_URL = "https://www.uniqlo.com/ca/api/commerce/v5/en"
PRODUCTS_API_URL = f"{API_BASE_URL}/products"
TAXONOMY_API_URL = f"{PRODUCTS_API_URL}/taxonomies"
CLIENT_ID = "uq.ca.web-spa"
SCRAPER_VERSION = "3.0.0-api"

# These are the same top-level category routes queried by scraper/main.py.
CATEGORY_ROUTES = (
    "men/tops",
    "men/outerwear",
    "men/sweaters-and-knitwear",
    "men/shirts-and-polo-shirts",
    "men/bottoms",
    "men/innerwear-and-base-layers",
    "men/loungewear",
    "men/accessories-and-home",
    "women/outerwear",
    "women/tops",
    "women/sweaters-and-knitwear",
    "women/shirts-and-blouses",
    "women/bottoms",
    "women/innerwear",
    "women/loungewear-and-homeware",
    "women/accessories-and-home",
    "kids/tops",
    "kids/bottoms",
    "kids/shirts-and-knitwear",
    "kids/outerwear",
    "kids/dresses-and-jumpsuits",
    "kids/innerwear-and-base-layers",
    "kids/accessories",
)

PAGE_SIZE = min(100, max(1, int(os.getenv("API_PAGE_SIZE", "100"))))
MAX_WORKERS = max(1, int(os.getenv("MAX_WORKERS", "4")))
REQUEST_TIMEOUT_SECONDS = max(1, int(os.getenv("REQUEST_TIMEOUT_SECONDS", "30")))
REQUEST_MAX_ATTEMPTS = max(1, int(os.getenv("REQUEST_MAX_ATTEMPTS", "4")))
RETRY_BASE_SECONDS = max(0.0, float(os.getenv("RETRY_BASE_SECONDS", "1")))
CATEGORY_MAX_ATTEMPTS = max(1, int(os.getenv("CATEGORY_MAX_ATTEMPTS", "2")))
IMAGE_WORKERS = max(1, int(os.getenv("IMAGE_WORKERS", "8")))
IMAGE_DOWNLOAD_TIMEOUT = max(1, int(os.getenv("IMAGE_DOWNLOAD_TIMEOUT", "30")))
DEFAULT_MIN_PRODUCTS = 500
SAVE_PHOTO = os.getenv("SAVE_PHOTO", "false").lower() == "true"

REQUEST_HEADERS = {
    "Accept": "application/json",
    "Accept-Language": "en-CA,en;q=0.9",
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
    ),
    "x-fr-clientid": CLIENT_ID,
}


@dataclass(frozen=True)
class Category:
    route: str
    gender_key: str
    gender_id: int
    class_id: int


@dataclass(frozen=True)
class CategoryResult:
    route: str
    products: list[dict[str, Any]]
    api_total: int


def get_min_products() -> int:
    """Return the minimum acceptable output count for a complete scrape."""
    raw_value = os.getenv("MIN_PRODUCTS", str(DEFAULT_MIN_PRODUCTS))
    try:
        minimum = int(raw_value)
    except ValueError as exc:
        raise ValueError(f"MIN_PRODUCTS must be an integer, got {raw_value!r}") from exc
    if minimum < 1:
        raise ValueError("MIN_PRODUCTS must be at least 1")
    return minimum


def response_excerpt(body: bytes, limit: int = 500) -> str:
    return " ".join(body.decode("utf-8", errors="replace").split())[:limit]


def request_json(url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """GET JSON directly, with bounded retries and no configured proxy."""
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"

    last_error: Exception | None = None
    for attempt in range(1, REQUEST_MAX_ATTEMPTS + 1):
        request = urllib.request.Request(url, headers=REQUEST_HEADERS)
        # Explicitly ignore proxy-related environment variables. This scraper is
        # intended to work directly from GitHub-hosted runners.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try:
            with opener.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                content_type = response.headers.get("Content-Type", "")
                body = response.read()
                if response.status != 200:
                    raise RuntimeError(f"unexpected HTTP status {response.status}")
                if "application/json" not in content_type.lower():
                    raise RuntimeError(
                        f"expected JSON but received {content_type!r}: "
                        f"{response_excerpt(body)!r}"
                    )
                payload = json.loads(body)
                if not isinstance(payload, dict):
                    raise RuntimeError("API response was not a JSON object")
                return payload
        except urllib.error.HTTPError as exc:
            body = exc.read()
            last_error = RuntimeError(
                f"HTTP {exc.code} from Uniqlo API: {response_excerpt(body)!r}"
            )
            retryable = exc.code == 429 or exc.code >= 500
            if not retryable:
                raise last_error from exc
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
            last_error = exc

        if attempt < REQUEST_MAX_ATTEMPTS:
            delay = RETRY_BASE_SECONDS * (2 ** (attempt - 1))
            print(
                f"WARNING: API request failed (attempt {attempt}/"
                f"{REQUEST_MAX_ATTEMPTS}); retrying in {delay:g}s: {last_error}"
            )
            time.sleep(delay)

    raise RuntimeError(
        f"Uniqlo API request failed after {REQUEST_MAX_ATTEMPTS} attempts: {last_error}"
    ) from last_error


def require_ok_result(payload: dict[str, Any], endpoint_name: str) -> dict[str, Any]:
    if payload.get("status") != "ok":
        raise ValueError(
            f"{endpoint_name} returned API status {payload.get('status')!r}"
        )
    result = payload.get("result")
    if not isinstance(result, dict):
        raise ValueError(f"{endpoint_name} response is missing its result object")
    return result


def resolve_categories(taxonomy_payload: dict[str, Any]) -> list[Category]:
    """Resolve every legacy route to the API's current gender/class IDs."""
    result = require_ok_result(taxonomy_payload, "taxonomy")
    genders = result.get("genders")
    classes = result.get("classes")
    if not isinstance(genders, list) or not isinstance(classes, list):
        raise ValueError("taxonomy response is missing genders or classes")

    gender_by_key = {
        gender.get("genderKey"): gender
        for gender in genders
        if isinstance(gender, dict) and gender.get("genderKey")
    }
    resolved = []
    for route in CATEGORY_ROUTES:
        gender_key, class_key = route.split("/", 1)
        gender = gender_by_key.get(gender_key)
        if not gender or not isinstance(gender.get("id"), int):
            raise ValueError(f"taxonomy could not resolve gender for {route!r}")

        matches = []
        for class_entry in classes:
            if not isinstance(class_entry, dict) or class_entry.get("key") != class_key:
                continue
            parents = class_entry.get("parents", [])
            if any(
                isinstance(parent, dict)
                and (
                    parent.get("id") == gender["id"]
                    or parent.get("key") == gender_key
                )
                for parent in parents
            ):
                matches.append(class_entry)

        if len(matches) != 1 or not isinstance(matches[0].get("id"), int):
            raise ValueError(
                f"taxonomy expected one class match for {route!r}, found "
                f"{len(matches)}"
            )
        resolved.append(
            Category(
                route=route,
                gender_key=gender_key,
                gender_id=gender["id"],
                class_id=matches[0]["id"],
            )
        )

    return resolved


def product_query(category: Category, offset: int) -> dict[str, Any]:
    return {
        "path": f"{category.gender_id},{category.class_id},,",
        "genderId": category.gender_id,
        "offset": offset,
        "limit": PAGE_SIZE,
        "rankingGender": category.gender_key,
        "rankingClassId": category.class_id,
        "httpFailure": "true",
    }


def fetch_product_page(category: Category, offset: int) -> tuple[list[dict[str, Any]], int]:
    result = require_ok_result(
        request_json(PRODUCTS_API_URL, product_query(category, offset)),
        f"products ({category.route})",
    )
    items = result.get("items")
    pagination = result.get("pagination")
    if not isinstance(items, list) or not isinstance(pagination, dict):
        raise ValueError(f"{category.route} response is missing items or pagination")
    total = pagination.get("total")
    response_offset = pagination.get("offset")
    count = pagination.get("count")
    if not isinstance(total, int) or total < 0:
        raise ValueError(f"{category.route} response has an invalid total")
    if response_offset != offset:
        raise ValueError(
            f"{category.route} returned offset {response_offset!r}, expected {offset}"
        )
    if count != len(items):
        raise ValueError(
            f"{category.route} reported {count!r} items but returned {len(items)}"
        )
    if any(not isinstance(item, dict) for item in items):
        raise ValueError(f"{category.route} returned a non-object product item")
    return items, total


def current_price(item: dict[str, Any]) -> str:
    prices = item.get("prices")
    if not isinstance(prices, dict):
        raise ValueError("product is missing prices")
    price = prices.get("promo") or prices.get("base")
    if not isinstance(price, dict) or not isinstance(price.get("value"), (int, float)):
        raise ValueError("product is missing a numeric current price")
    currency = price.get("currency")
    code = currency.get("code") if isinstance(currency, dict) else None
    if code != "CAD":
        raise ValueError(f"expected CAD price, received {code!r}")
    return f"CA $ {price['value']:.2f}"


def product_image_url(item: dict[str, Any]) -> str | None:
    images = item.get("images")
    main_images = images.get("main") if isinstance(images, dict) else None
    if not isinstance(main_images, dict) or not main_images:
        return None

    preferred_codes = [item.get("representativeColorDisplayCode")]
    representative = item.get("representative")
    if isinstance(representative, dict):
        color = representative.get("color")
        if isinstance(color, dict):
            preferred_codes.append(color.get("displayCode"))
    for code in preferred_codes:
        image = main_images.get(code) if code is not None else None
        if isinstance(image, dict) and image.get("image"):
            return image["image"]
    for image in main_images.values():
        if isinstance(image, dict) and image.get("image"):
            return image["image"]
    return None


def parse_product(item: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
    product_id = item.get("productId")
    name = item.get("name")
    if not isinstance(product_id, str) or not product_id:
        raise ValueError("product is missing productId")
    if not isinstance(name, str) or not name.strip():
        raise ValueError(f"product {product_id} is missing its name")
    price_group = item.get("priceGroup")
    if not isinstance(price_group, str) or not price_group:
        price_group = "00"
    product = {
        "product_id": product_id,
        "name": name.strip(),
        "price": current_price(item),
        "url": f"{SITE_BASE_URL}/products/{product_id}/{price_group}",
        "image": None,
    }
    return product, product_image_url(item)


PageFetcher = Callable[[Category, int], tuple[list[dict[str, Any]], int]]


def scrape_category(
    category: Category,
    worker_id: int = 0,
    page_fetcher: PageFetcher | None = None,
) -> tuple[CategoryResult, dict[str, str]]:
    """Fetch and validate every API page for one category."""
    fetch_page = page_fetcher or fetch_product_page
    print(f"[Worker {worker_id}] Starting: {category.route}")
    offset = 0
    expected_total: int | None = None
    listing_keys: set[tuple[str, str]] = set()
    products_by_id: dict[str, dict[str, Any]] = {}
    images_by_id: dict[str, str] = {}

    while expected_total is None or offset < expected_total:
        items, page_total = fetch_page(category, offset)
        if expected_total is None:
            expected_total = page_total
        elif page_total != expected_total:
            raise RuntimeError(
                f"{category.route} total changed during pagination "
                f"({expected_total} -> {page_total})"
            )
        if expected_total == 0:
            raise RuntimeError(f"{category.route} returned no products")
        if not items:
            raise RuntimeError(
                f"{category.route} returned an empty page at {offset}/"
                f"{expected_total}"
            )

        for item in items:
            listing_key = (str(item.get("productId")), str(item.get("priceGroup")))
            if listing_key in listing_keys:
                raise RuntimeError(
                    f"{category.route} returned duplicate listing {listing_key} "
                    "across API pages"
                )
            listing_keys.add(listing_key)
            product, image_url = parse_product(item)
            if product["product_id"] not in products_by_id:
                products_by_id[product["product_id"]] = product
                if image_url:
                    images_by_id[product["product_id"]] = image_url
        offset += len(items)

    if len(listing_keys) != expected_total:
        raise RuntimeError(
            f"{category.route} coverage check failed: received {len(listing_keys)} "
            f"of {expected_total} API listings"
        )

    products = list(products_by_id.values())
    print(
        f"[Worker {worker_id}] Completed: {category.route} "
        f"({len(products)} products; {expected_total} API listings verified)"
    )
    return CategoryResult(category.route, products, expected_total), images_by_id


def scrape_category_with_retries(
    category: Category, worker_id: int
) -> tuple[CategoryResult, dict[str, str]]:
    last_error: Exception | None = None
    for attempt in range(1, CATEGORY_MAX_ATTEMPTS + 1):
        try:
            return scrape_category(category, worker_id)
        except Exception as exc:
            last_error = exc
            print(
                f"[Worker {worker_id}] ERROR: {category.route} attempt "
                f"{attempt}/{CATEGORY_MAX_ATTEMPTS} failed: {exc}"
            )
            if attempt < CATEGORY_MAX_ATTEMPTS:
                time.sleep(RETRY_BASE_SECONDS * attempt)
    raise RuntimeError(
        f"{category.route} failed after {CATEGORY_MAX_ATTEMPTS} attempts: {last_error}"
    ) from last_error


def download_product_image(product_id: str, image_url: str) -> str:
    image_path = Path("images") / f"{product_id}.jpg"
    image_path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        image_url,
        headers={
            "Accept": "image/jpeg,image/*;q=0.8,*/*;q=0.5",
            "User-Agent": REQUEST_HEADERS["User-Agent"],
        },
    )
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(request, timeout=IMAGE_DOWNLOAD_TIMEOUT) as response:
        image_path.write_bytes(response.read())
    return image_path.as_posix()


def add_images(
    prices: dict[str, list[dict[str, Any]]], images_by_id: dict[str, str]
) -> int:
    """Download unique images and attach paths to every category occurrence."""
    if not SAVE_PHOTO:
        return 0
    if not images_by_id:
        print("WARNING: The API returned no product image URLs")
        return 0
    Path("images").mkdir(parents=True, exist_ok=True)
    paths: dict[str, str] = {}
    failures = 0
    with ThreadPoolExecutor(max_workers=min(IMAGE_WORKERS, len(images_by_id))) as pool:
        futures = {
            pool.submit(download_product_image, product_id, image_url): product_id
            for product_id, image_url in images_by_id.items()
        }
        for future in as_completed(futures):
            product_id = futures[future]
            try:
                paths[product_id] = future.result()
            except Exception as exc:
                failures += 1
                print(f"WARNING: Image download failed for {product_id}: {exc}")

    for products in prices.values():
        for product in products:
            product["image"] = paths.get(product["product_id"])
    print(f"INFO: Downloaded {len(paths)}/{len(images_by_id)} unique product images")
    return failures


def create_archive(
    prices: dict[str, list[dict[str, Any]]],
    total_failed: int,
    duration_seconds: float,
) -> None:
    categories = list(prices)
    total_products = sum(len(products) for products in prices.values())
    output = {
        "metadata": {
            "datetime": datetime.now(timezone.utc).isoformat(),
            "scraper_version": SCRAPER_VERSION,
            "duration_seconds": duration_seconds,
            "total_products": total_products,
            "total_failed": total_failed,
            "categories_scraped": len(categories),
            "categories": categories,
        },
        "products": prices,
    }
    with open("prices.json", "w", encoding="utf-8") as output_file:
        json.dump(output, output_file, indent=2, ensure_ascii=False)
    with zipfile.ZipFile("output.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        archive.write("prices.json")
        images_path = Path("images")
        if images_path.exists():
            for image_file in images_path.rglob("*"):
                if image_file.is_file():
                    archive.write(image_file)
    print(
        f"INFO: Created output.zip with {total_products} products across "
        f"{len(categories)} categories"
    )


def main() -> None:
    for old_output in (Path("prices.json"), Path("output.zip")):
        old_output.unlink(missing_ok=True)
    images_path = Path("images")
    if images_path.exists():
        shutil.rmtree(images_path)

    print("INFO: Resolving 23 configured routes against Uniqlo's live taxonomy")
    categories = resolve_categories(request_json(TAXONOMY_API_URL))
    print(f"INFO: Resolved all {len(categories)} category routes")
    print(f"INFO: Product image downloads enabled: {SAVE_PHOTO}")

    start_time = time.time()
    results_by_route: dict[str, CategoryResult] = {}
    all_images: dict[str, str] = {}
    failures: dict[str, str] = {}
    worker_count = min(MAX_WORKERS, len(categories))
    with ThreadPoolExecutor(max_workers=worker_count) as pool:
        futures = {
            pool.submit(scrape_category_with_retries, category, worker_id): category
            for worker_id, category in enumerate(categories, start=1)
        }
        for future in as_completed(futures):
            category = futures[future]
            try:
                result, images = future.result()
                results_by_route[result.route] = result
                all_images.update(images)
            except Exception as exc:
                failures[category.route] = str(exc)

    if failures:
        print(
            f"ERROR: Completed {len(results_by_route)}/{len(categories)} categories. "
            "Refusing to create a partial ingest archive."
        )
        for route, error in failures.items():
            print(f"ERROR: {route}: {error}")
        raise SystemExit(1)

    prices = {
        route: results_by_route[route].products for route in CATEGORY_ROUTES
    }
    total_products = sum(len(products) for products in prices.values())
    minimum = get_min_products()
    if total_products < minimum:
        print(
            f"ERROR: Scrape produced {total_products} products; required minimum is "
            f"{minimum}. Refusing to create an ingest archive."
        )
        raise SystemExit(1)

    image_failures = add_images(prices, all_images)
    duration_seconds = round(time.time() - start_time, 2)
    create_archive(prices, image_failures, duration_seconds)


if __name__ == "__main__":
    main()
