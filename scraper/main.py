import json
import re
import time
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

DEBUG_MODE = True
MAX_WORKERS = 3
WAIT_TIMEOUT = 15  # seconds to wait for elements
SCRAPER_VERSION = "1.0.0"

URLS = [
    'https://www.uniqlo.com/ca/en/men/tops',
    'https://www.uniqlo.com/ca/en/men/outerwear',
    'https://www.uniqlo.com/ca/en/men/sweaters-and-knitwear',
    'https://www.uniqlo.com/ca/en/men/shirts-and-polo-shirts',
    'https://www.uniqlo.com/ca/en/men/bottoms',
    'https://www.uniqlo.com/ca/en/men/innerwear-and-base-layers/',
    'https://www.uniqlo.com/ca/en/men/loungewear',
    'https://www.uniqlo.com/ca/en/men/accessories-and-home',
    'https://www.uniqlo.com/ca/en/men/sport-utility-wear'
]
PRICES = {}
PRICES_LOCK = Lock()
SAVE_PHOTO = True


def extract_product_id(url):
    """Extract product ID from Uniqlo product URL.

    Example: https://www.uniqlo.com/ca/en/products/E482305-000/00?colorDisplayCode=00
    Returns: E482305-000
    """
    match = re.search(r'/products/([^/]+)/', url)
    return match.group(1) if match else None


def create_driver():
    """Create and configure a new Chrome WebDriver instance."""
    # src: https://www.scrapingbee.com/blog/selenium-python/
    opts = Options()
    # opts.add_argument("--headless")  # modern headless mode (Chrome 109+)
    opts.add_argument("--no-sandbox")         # handy for CI or Docker
    opts.add_argument("--disable-dev-shm-usage")  # avoids /dev/shm issues in containers
    opts.add_argument("--headless=new")
    return webdriver.Chrome(options=opts)


def scrape_url(url, worker_id):
    """Scrape a single URL category. Each call gets its own browser instance."""
    driver = None
    # Extract url_key before try block so it's available in except block
    url_key = url.split('https://www.uniqlo.com/ca/en/')[1].rstrip('/')
    try:
        driver = create_driver()
        print(f"[Worker {worker_id}] Starting: {url_key}")

        driver.get(url)
        reject_cookies(driver, worker_id)

        # Wait for product grid to load
        wait = WebDriverWait(driver, WAIT_TIMEOUT)
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, 'fr-ec-product-collection')))

        if DEBUG_MODE:
            print(f"[Worker {worker_id}] DEBUG: Driver Title: {driver.title}")
            # driver.save_screenshot(f"debug_page_start_{worker_id}.png")

        scroll_end(driver, worker_id)

        # if DEBUG_MODE:
        #     driver.save_screenshot(f"debug_page_end_{worker_id}.png")

        links = get_grid_links(driver, worker_id, wait)
        if DEBUG_MODE:
            print(f"[Worker {worker_id}] DEBUG: Links: {links}")

        local_prices = []
        failed_count = 0
        skipped_duplicates = 0
        seen_product_ids = set()

        for link in links:
            # Extract and check for duplicate product IDs
            product_id = extract_product_id(link)
            if product_id and product_id in seen_product_ids:
                skipped_duplicates += 1
                if DEBUG_MODE:
                    print(f"[Worker {worker_id}] DEBUG: Skipping duplicate product: {product_id}")
                continue
            if product_id:
                seen_product_ids.add(product_id)

            try:
                if DEBUG_MODE:
                    print(f"[Worker {worker_id}] DEBUG: Visiting link: {link}")
                driver.get(link)

                # Wait for product name element to be present
                name_xpath = '/html/body/div[1]/div/div/div[1]/div[2]/div/div[1]/div/main/div[1]/div'
                price_xpath = '/html/body/div[1]/div/div/div[1]/div[2]/div/div[1]/div/main/div[5]/div/div/div[1]/div/div/p'

                wait.until(EC.presence_of_element_located((By.XPATH, name_xpath)))
                name = driver.find_element(By.XPATH, name_xpath).text
                price = driver.find_element(By.XPATH, price_xpath).text

                image_path_str = None
                if SAVE_PHOTO:
                    image = driver.find_element(By.CSS_SELECTOR, '.image--ratio-3x4 .image__img')
                    image_url = image.get_attribute('src')

                    folder_path = Path("images") / url_key
                    folder_path.mkdir(parents=True, exist_ok=True)

                    image_path = folder_path / f"{product_id}.jpg"

                    urllib.request.urlretrieve(image_url, str(image_path))
                    # Store as POSIX path for cross-platform compatibility
                    image_path_str = image_path.as_posix()
                    if DEBUG_MODE:
                        print(f"[Worker {worker_id}] DEBUG: Saved image to {image_path_str}")

                if DEBUG_MODE:
                    print(f"[Worker {worker_id}] DEBUG: Product ID: {product_id} | Name: {name} | Price: {price}")

                local_prices.append({
                    "product_id": product_id,
                    "name": name,
                    "price": price,
                    "url": link,
                    "image": image_path_str
                })

            except Exception as e:
                failed_count += 1
                print(f"[Worker {worker_id}] WARNING: Failed to scrape product at {link}: {e}")
                continue

        if failed_count > 0:
            print(f"[Worker {worker_id}] INFO: {failed_count} products failed to scrape in {url_key}")
        if skipped_duplicates > 0:
            print(f"[Worker {worker_id}] INFO: {skipped_duplicates} duplicate products skipped in {url_key}")

        # Thread-safe update of global PRICES dictionary
        with PRICES_LOCK:
            PRICES[url_key] = local_prices

        print(f"[Worker {worker_id}] Completed: {url_key} ({len(local_prices)} products)")
        return url_key, len(local_prices), failed_count

    except Exception as e:
        print(f"[Worker {worker_id}] ERROR scraping {url_key}: {e}")
        return url_key, 0, 0

    finally:
        if driver:
            driver.quit()


def main():
    # Clean up old images before starting
    images_path = Path("images")
    if images_path.exists():
        import shutil
        shutil.rmtree(images_path)
        print("INFO: Cleaned up old images folder")

    print(f"INFO: Starting scraper with {MAX_WORKERS} concurrent browsers")
    print(f"INFO: Processing {len(URLS)} URLs")

    start_time = time.time()
    total_products = 0
    total_failed = 0
    categories_scraped = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(scrape_url, url, i): url
            for i, url in enumerate(URLS)
        }

        for future in as_completed(futures):
            url = futures[future]
            try:
                url_key, count, failed = future.result()
                total_products += count
                total_failed += failed
                categories_scraped.append(url_key)
                print(f"INFO: Finished {url_key} with {count} products")
            except Exception as e:
                print(f"ERROR: {url} generated an exception: {e}")

    end_time = time.time()
    duration_seconds = round(end_time - start_time, 2)

    if DEBUG_MODE:
        print("DEBUG: Final Prices Dictionary:", PRICES)

    # Build output with metadata
    output = {
        "metadata": {
            "datetime": datetime.now(timezone.utc).isoformat(),
            "scraper_version": SCRAPER_VERSION,
            "duration_seconds": duration_seconds,
            "total_products": total_products,
            "total_failed": total_failed,
            "categories_scraped": len(categories_scraped),
            "categories": categories_scraped
        },
        "products": PRICES
    }

    # Save prices to JSON file
    with open('prices.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"INFO: Prices saved to prices.json ({total_products} products across {len(categories_scraped)} categories)")

    # Create zip archive with images and prices.json
    zip_filename = "output.zip"

    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add prices.json
        zipf.write('prices.json')

        # Add all images
        images_path = Path("images")
        if images_path.exists():
            for image_file in images_path.rglob("*"):
                if image_file.is_file():
                    zipf.write(image_file)

    print(f"INFO: Created archive {zip_filename}")


def reject_cookies(driver, worker_id=0):
    print(f"[Worker {worker_id}] INFO: Attempting to reject cookies.")
    try:
        wait = WebDriverWait(driver, WAIT_TIMEOUT)
        cookie_button = wait.until(EC.element_to_be_clickable((By.ID, 'onetrust-reject-all-handler')))
        cookie_button.click()
        # Wait for cookie banner to disappear
        wait.until(EC.invisibility_of_element_located((By.ID, 'onetrust-reject-all-handler')))
        print(f"[Worker {worker_id}] SUCCESS: Cookies rejected.")
    except Exception as e:
        print(f"[Worker {worker_id}] INFO: No cookie button found (may already be dismissed): {e}")


def scroll_end(driver, worker_id=0):
    # https://stackoverflow.com/questions/48850974/selenium-scroll-to-end-of-page-in-dynamically-loading-webpage
    print(f"[Worker {worker_id}] INFO: Scrolling to the end of the page.")

    last_height = driver.execute_script("return document.body.scrollHeight")
    i = 0

    while True:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")

        # Wait for page height to potentially change (dynamic content loading)
        # Using a short sleep here since we're waiting for scroll-triggered lazy loading
        time.sleep(1)

        new_height = driver.execute_script("return document.body.scrollHeight")

        # if DEBUG_MODE:
        #     driver.save_screenshot(f"page_scroll_{worker_id}_{i}.png")
        i += 1

        if new_height == last_height:
            break
        last_height = new_height


def get_grid_links(driver, worker_id=0, wait=None):
    if wait:
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, 'fr-ec-product-collection')))

    grid_container = driver.find_element(By.CLASS_NAME, 'fr-ec-product-collection')
    grid_items = grid_container.find_elements(By.XPATH, "./div")
    print(f"[Worker {worker_id}] INFO: Found {len(grid_items)} grid items.")

    links = []
    for item in grid_items:
        link_element = item.find_element(By.TAG_NAME, 'a')
        link = link_element.get_attribute('href')
        links.append(link)
    return links

if __name__ == "__main__":
    main()
