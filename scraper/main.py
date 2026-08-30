import json
import os
import re
import shutil
import time
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from urllib.parse import urljoin

from playwright.sync_api import Locator, Page, TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


BASE_URL = "https://www.uniqlo.com"
CATEGORY_PREFIX = f"{BASE_URL}/ca/en/"
PRODUCT_CARD_SELECTOR = (
    '.fr-ec-product-collection a.product-tile__link[href*="/products/"]'
)
PRICE_PATTERN = re.compile(r"CA\s*\$\s*\d+(?:\.\d{2})?")

DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "1"))
WAIT_TIMEOUT_MS = int(os.getenv("WAIT_TIMEOUT_MS", "30000"))
PAGE_TIMEOUT_MS = int(os.getenv("PAGE_TIMEOUT_MS", "60000"))
SCROLL_PAUSE_MS = int(os.getenv("SCROLL_PAUSE_MS", "1000"))
MAX_SCROLLS = int(os.getenv("MAX_SCROLLS", "80"))
STABLE_SCROLL_ROUNDS = int(os.getenv("STABLE_SCROLL_ROUNDS", "3"))
CATEGORY_PAUSE_SECONDS = float(os.getenv("CATEGORY_PAUSE_SECONDS", "5"))
CATEGORY_MAX_ATTEMPTS = max(1, int(os.getenv("CATEGORY_MAX_ATTEMPTS", "2")))
IMAGE_DOWNLOAD_TIMEOUT = int(os.getenv("IMAGE_DOWNLOAD_TIMEOUT", "30"))
SCRAPER_VERSION = "2.0.0"
DEFAULT_MIN_PRODUCTS = 500
SAVE_PHOTO = os.getenv("SAVE_PHOTO", "false").lower() == "true"
BLOCK_BROWSER_ASSETS = os.getenv("BLOCK_BROWSER_ASSETS", "true").lower() == "true"
HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"

URLS = [
    # Men's
    "https://www.uniqlo.com/ca/en/men/tops",
    "https://www.uniqlo.com/ca/en/men/outerwear",
    "https://www.uniqlo.com/ca/en/men/sweaters-and-knitwear",
    "https://www.uniqlo.com/ca/en/men/shirts-and-polo-shirts",
    "https://www.uniqlo.com/ca/en/men/bottoms",
    "https://www.uniqlo.com/ca/en/men/innerwear-and-base-layers/",
    "https://www.uniqlo.com/ca/en/men/loungewear",
    "https://www.uniqlo.com/ca/en/men/accessories-and-home",
    # Women's
    "https://www.uniqlo.com/ca/en/women/outerwear",
    "https://www.uniqlo.com/ca/en/women/tops",
    "https://www.uniqlo.com/ca/en/women/sweaters-and-knitwear",
    "https://www.uniqlo.com/ca/en/women/shirts-and-blouses",
    "https://www.uniqlo.com/ca/en/women/bottoms",
    "https://www.uniqlo.com/ca/en/women/innerwear",
    "https://www.uniqlo.com/ca/en/women/loungewear-and-homeware",
    "https://www.uniqlo.com/ca/en/women/accessories-and-home",
    # Kids
    "https://www.uniqlo.com/ca/en/kids/tops",
    "https://www.uniqlo.com/ca/en/kids/bottoms",
    "https://www.uniqlo.com/ca/en/kids/shirts-and-knitwear",
    "https://www.uniqlo.com/ca/en/kids/outerwear",
    "https://www.uniqlo.com/ca/en/kids/dresses-and-jumpsuits",
    "https://www.uniqlo.com/ca/en/kids/innerwear-and-base-layers",
    "https://www.uniqlo.com/ca/en/kids/accessories",
]

PRICES = {}
PRICES_LOCK = Lock()
IMAGE_LOCKS = {}
IMAGE_LOCKS_LOCK = Lock()


def get_min_products():
    """Return the minimum acceptable product count for a complete scrape."""
    raw_value = os.getenv("MIN_PRODUCTS", str(DEFAULT_MIN_PRODUCTS))
    try:
        min_products = int(raw_value)
    except ValueError as exc:
        raise ValueError(f"MIN_PRODUCTS must be an integer, got {raw_value!r}") from exc
    if min_products < 1:
        raise ValueError("MIN_PRODUCTS must be at least 1")
    return min_products


def extract_product_id(url):
    """Extract the product ID from a Uniqlo product URL."""
    match = re.search(r"/products/([^/]+)/", url)
    return match.group(1) if match else None


def extract_price(text):
    """Extract and normalize the current Canadian price from card text."""
    match = PRICE_PATTERN.search(text)
    if not match:
        raise ValueError("product card does not contain a Canadian price")
    return re.sub(r"\s+", " ", match.group(0)).strip()


def normalize_product_url(url):
    """Return an absolute Uniqlo product URL."""
    return urljoin(BASE_URL, url)


def choose_image_url(candidates):
    """Choose the primary 3x4 product image from (src, data-src) candidates."""
    fallback = None
    for src, data_src in candidates:
        for value in (src, data_src):
            if not value:
                continue
            fallback = fallback or value
            if "/imagesgoods/" in value and "_3x4" in value:
                return value
    return fallback


def get_proxy_config():
    """Build Playwright proxy settings from optional environment variables."""
    server = os.getenv("PROXY_SERVER", "").strip()
    username = os.getenv("PROXY_USERNAME", "").strip()
    password = os.getenv("PROXY_PASSWORD", "")
    if not server:
        if username or password:
            raise ValueError("PROXY_SERVER is required when proxy credentials are set")
        return None
    proxy = {"server": server}
    if username:
        proxy["username"] = username
    if password:
        proxy["password"] = password
    return proxy


def launch_browser(playwright):
    """Launch Chrome/Chromium with optional authenticated proxy support."""
    options = {
        "headless": HEADLESS,
        "args": ["--disable-blink-features=AutomationControlled"],
        "ignore_default_args": ["--enable-automation"],
    }
    chrome_binary = os.getenv("CHROME_BINARY", "").strip()
    if chrome_binary:
        options["executable_path"] = chrome_binary
    else:
        options["channel"] = os.getenv("CHROME_CHANNEL", "chrome")
    proxy = get_proxy_config()
    if proxy:
        options["proxy"] = proxy
    return playwright.chromium.launch(**options)


def configure_context(context):
    """Reduce automation signals and block assets not needed for card parsing."""
    context.add_init_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    if not BLOCK_BROWSER_ASSETS:
        return

    def handle_route(route):
        if route.request.resource_type in {"image", "font", "media"}:
            route.abort()
        else:
            route.continue_()

    context.route("**/*", handle_route)


def reject_cookies(page, worker_id=0):
    """Dismiss the OneTrust banner when it is present."""
    try:
        button = page.locator("#onetrust-reject-all-handler")
        button.wait_for(state="visible", timeout=5000)
        button.click()
        print(f"[Worker {worker_id}] INFO: Cookies rejected.")
    except PlaywrightTimeoutError:
        if DEBUG_MODE:
            print(f"[Worker {worker_id}] DEBUG: Cookie banner was not shown.")


def page_diagnostics(page):
    """Return safe, concise page details for blocked or changed pages."""
    try:
        title = page.title()
    except Exception:
        title = "<unavailable>"
    try:
        body = page.locator("body").inner_text(timeout=3000)
        body = re.sub(r"\s+", " ", body).strip()[:500]
    except Exception:
        body = "<unavailable>"
    return title, page.url, body


def raise_if_blocked(page):
    """Fail quickly when an edge provider returns an access-denied page."""
    title, current_url, body = page_diagnostics(page)
    evidence = f"{title} {body}".lower()
    if "access denied" in evidence or "permission to access" in evidence:
        raise RuntimeError(
            f"Uniqlo denied this network/browser (title={title!r}, url={current_url})"
        )


def scroll_until_loaded(page, worker_id=0):
    """Scroll until the number of product cards remains stable."""
    cards = page.locator(PRODUCT_CARD_SELECTOR)
    previous_count = cards.count()
    stable_rounds = 0
    for _ in range(MAX_SCROLLS):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(SCROLL_PAUSE_MS)
        current_count = cards.count()
        if current_count == previous_count:
            stable_rounds += 1
            if stable_rounds >= STABLE_SCROLL_ROUNDS:
                break
        else:
            stable_rounds = 0
            previous_count = current_count
    print(f"[Worker {worker_id}] INFO: Loaded {cards.count()} listing cards.")


def get_image_lock(product_id):
    with IMAGE_LOCKS_LOCK:
        return IMAGE_LOCKS.setdefault(product_id, Lock())


def download_product_image(image_url, product_id):
    """Download one shared product image without using the browser proxy."""
    image_path = Path("images") / f"{product_id}.jpg"
    image_path.parent.mkdir(parents=True, exist_ok=True)
    with get_image_lock(product_id):
        if image_path.exists() and image_path.stat().st_size > 0:
            return image_path.as_posix()
        request = urllib.request.Request(
            image_url,
            headers={
                "Accept": "image/jpeg,image/*;q=0.8,*/*;q=0.5",
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/150.0.0.0 Safari/537.36"
                ),
            },
        )
        direct_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with direct_opener.open(request, timeout=IMAGE_DOWNLOAD_TIMEOUT) as response:
            image_path.write_bytes(response.read())
    return image_path.as_posix()


def card_image_url(card):
    images = card.locator(".product-tile__carousel-wrapper img.image__img")
    candidates = []
    for index in range(images.count()):
        image = images.nth(index)
        candidates.append((image.get_attribute("src"), image.get_attribute("data-src")))
    return choose_image_url(candidates)


def parse_product_card(card: Locator):
    """Extract one product record from a category listing card."""
    raw_url = card.get_attribute("href")
    if not raw_url:
        raise ValueError("product card is missing its URL")
    url = normalize_product_url(raw_url)
    product_id = extract_product_id(url)
    if not product_id:
        raise ValueError(f"could not determine product ID from {url}")
    name = card.locator("h2").first.inner_text(timeout=5000).strip()
    if not name:
        raise ValueError(f"product {product_id} is missing its name")
    return {
        "product_id": product_id,
        "name": name,
        "price": extract_price(card.inner_text(timeout=5000)),
        "url": url,
        "image_url": card_image_url(card),
    }


def scrape_category(page: Page, url, worker_id):
    """Scrape all products from one category listing without visiting PDPs."""
    url_key = url.removeprefix(CATEGORY_PREFIX).rstrip("/")
    try:
        print(f"[Worker {worker_id}] Starting: {url_key}")
        page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
        raise_if_blocked(page)
        reject_cookies(page, worker_id)
        page.locator(".fr-ec-product-collection").wait_for(
            state="attached", timeout=WAIT_TIMEOUT_MS
        )
        scroll_until_loaded(page, worker_id)

        cards = page.locator(PRODUCT_CARD_SELECTOR)
        local_prices = []
        failed_count = 0
        seen_product_ids = set()
        for index in range(cards.count()):
            try:
                product = parse_product_card(cards.nth(index))
                product_id = product["product_id"]
                if product_id in seen_product_ids:
                    continue
                seen_product_ids.add(product_id)
                image_path = None
                if SAVE_PHOTO and product["image_url"]:
                    try:
                        image_path = download_product_image(
                            product["image_url"], product_id
                        )
                    except Exception as exc:
                        failed_count += 1
                        print(
                            f"[Worker {worker_id}] WARNING: Image download failed "
                            f"for {product_id}: {exc}"
                        )
                local_prices.append(
                    {
                        "product_id": product_id,
                        "name": product["name"],
                        "price": product["price"],
                        "url": product["url"],
                        "image": image_path,
                    }
                )
            except Exception as exc:
                failed_count += 1
                print(
                    f"[Worker {worker_id}] WARNING: Failed to parse listing card "
                    f"{index + 1}: {exc}"
                )

        if not local_prices:
            raise RuntimeError("category listing contained no parseable products")
        with PRICES_LOCK:
            PRICES[url_key] = local_prices
        print(f"[Worker {worker_id}] Completed: {url_key} ({len(local_prices)} products)")
        return url_key, len(local_prices), failed_count, True
    except Exception as exc:
        title, current_url, body = page_diagnostics(page)
        print(f"[Worker {worker_id}] ERROR scraping {url_key}: {exc}")
        print(
            f"[Worker {worker_id}] DIAGNOSTIC: title={title!r} "
            f"url={current_url!r} body={body!r}"
        )
        return url_key, 0, 0, False


def scrape_category_batch(worker_id, urls):
    """Scrape a worker's category batch using isolated browser sessions."""
    results = []
    try:
        with sync_playwright() as playwright:
            for index, url in enumerate(urls):
                result = None
                for attempt in range(1, CATEGORY_MAX_ATTEMPTS + 1):
                    browser = launch_browser(playwright)
                    try:
                        context = browser.new_context(
                            locale="en-CA",
                            timezone_id="America/Toronto",
                            viewport={"width": 1440, "height": 1200},
                        )
                        configure_context(context)
                        page = context.new_page()
                        result = scrape_category(page, url, worker_id)
                    finally:
                        browser.close()
                    if result[3]:
                        break
                    if attempt < CATEGORY_MAX_ATTEMPTS:
                        print(
                            f"[Worker {worker_id}] INFO: Retrying category "
                            f"after failed attempt {attempt}."
                        )
                        time.sleep(CATEGORY_PAUSE_SECONDS)
                results.append(result)
                if index < len(urls) - 1:
                    time.sleep(CATEGORY_PAUSE_SECONDS)
    except Exception as exc:
        print(f"[Worker {worker_id}] ERROR: Browser worker failed: {exc}")
        completed_keys = {result[0] for result in results}
        for url in urls:
            url_key = url.removeprefix(CATEGORY_PREFIX).rstrip("/")
            if url_key not in completed_keys:
                results.append((url_key, 0, 0, False))
    return results


def create_archive(total_products, total_failed, categories_scraped, duration_seconds):
    output = {
        "metadata": {
            "datetime": datetime.now(timezone.utc).isoformat(),
            "scraper_version": SCRAPER_VERSION,
            "duration_seconds": duration_seconds,
            "total_products": total_products,
            "total_failed": total_failed,
            "categories_scraped": len(categories_scraped),
            "categories": categories_scraped,
        },
        "products": PRICES,
    }
    with open("prices.json", "w", encoding="utf-8") as output_file:
        json.dump(output, output_file, indent=2, ensure_ascii=False)
    print(
        f"INFO: Prices saved to prices.json ({total_products} products across "
        f"{len(categories_scraped)} categories)"
    )
    with zipfile.ZipFile("output.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        archive.write("prices.json")
        images_path = Path("images")
        if images_path.exists():
            for image_file in images_path.rglob("*"):
                if image_file.is_file():
                    archive.write(image_file)
    print("INFO: Created archive output.zip")


def main():
    PRICES.clear()
    IMAGE_LOCKS.clear()
    images_path = Path("images")
    if images_path.exists():
        shutil.rmtree(images_path)
        print("INFO: Cleaned up old images folder")

    worker_count = min(MAX_WORKERS, len(URLS))
    url_batches = [URLS[index::worker_count] for index in range(worker_count)]
    print(f"INFO: Starting scraper with {worker_count} isolated browser workers")
    print(f"INFO: Processing {len(URLS)} category listings")
    print(f"INFO: Browser proxy enabled: {bool(get_proxy_config())}")
    print(f"INFO: Product image downloads enabled: {SAVE_PHOTO}")

    start_time = time.time()
    all_results = []
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = {
            executor.submit(scrape_category_batch, worker_id, batch): worker_id
            for worker_id, batch in enumerate(url_batches)
        }
        for future in as_completed(futures):
            all_results.extend(future.result())

    total_products = sum(result[1] for result in all_results)
    total_failed = sum(result[2] for result in all_results)
    categories_scraped = [result[0] for result in all_results if result[3]]
    categories_failed = [result[0] for result in all_results if not result[3]]
    duration_seconds = round(time.time() - start_time, 2)

    min_products = get_min_products()
    if total_products < min_products or categories_failed:
        print(
            f"ERROR: Scrape produced {total_products} products; required minimum is "
            f"{min_products}. Refusing to create an ingest archive."
        )
        print(
            f"ERROR: Successful categories: {len(categories_scraped)}/{len(URLS)}; "
            f"failed categories: {len(categories_failed)}"
        )
        if categories_failed:
            print(f"ERROR: Failed category names: {', '.join(categories_failed)}")
        raise SystemExit(1)

    create_archive(
        total_products,
        total_failed,
        categories_scraped,
        duration_seconds,
    )


if __name__ == "__main__":
    main()
