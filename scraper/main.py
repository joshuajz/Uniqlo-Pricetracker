import os
import re
import time
import urllib.request
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

DEBUG_MODE = True

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
SAVE_PHOTO = True

def main():
    # src: https://www.scrapingbee.com/blog/selenium-python/
    opts = Options()
    # opts.add_argument("--headless")  # modern headless mode (Chrome 109+)
    opts.add_argument("--no-sandbox")         # handy for CI or Docker
    opts.add_argument("--disable-dev-shm-usage")  # avoids /dev/shm issues in containers

    driver = webdriver.Chrome(options=opts)
    driver.get("https://www.uniqlo.com/ca/en/men/tops")

    reject_cookies(driver)

    for url in URLS:
        driver.get(url)
        time.sleep(2)
        url_key = url.split('https://www.uniqlo.com/ca/en/')[1]

        if DEBUG_MODE:
            print("DEBUG: Driver Title: ", driver.title)
            driver.save_screenshot(f"debug_page_start.png")

        scroll_end(driver)

        if DEBUG_MODE: driver.save_screenshot("debug_page_end.png")

        links = get_grid_links(driver)
        if DEBUG_MODE: print("DEBUG: Links:", links)

        for link in links:
            if DEBUG_MODE: print("DEBUG: Visiting link:", link)
            driver.get(link)
            time.sleep(2)

            name  = driver.find_element(By.XPATH, '/html/body/div[1]/div/div/div[1]/div[2]/div/div[1]/div/main/div[1]/div').text
            price = driver.find_element(By.XPATH, '/html/body/div[1]/div/div/div[1]/div[2]/div/div[1]/div/main/div[5]/div/div/div[1]/div/div/p').text
            if SAVE_PHOTO:
                # Find the main product image (parent has image--ratio-3x4 class)
                image = driver.find_element(By.CSS_SELECTOR, '.image--ratio-3x4 .image__img')
                image_url = image.get_attribute('src')

                # Create folder for this category
                folder_path = f"images/{url_key}"
                os.makedirs(folder_path, exist_ok=True)

                # Sanitize product name for filename (replace invalid chars and spaces with underscores)
                safe_name = re.sub(r'[<>:"/\\|?*\s]+', '_', name).strip('_')
                file_path = f"{folder_path}/{safe_name}.jpg"

                urllib.request.urlretrieve(image_url, file_path)
                if DEBUG_MODE: print(f"DEBUG: Saved image to {file_path}")

            if DEBUG_MODE: print(f"DEBUG: Product Name: {name} | Price: {price}")

            if (PRICES.get(f"{url_key}") is None):
                PRICES[f"{url_key}"] = [(name, price)]
            else:
                PRICES[f"{url_key}"].append((name, price))

            break

    if DEBUG_MODE: print("DEBUG: Final Prices Dictionary:", PRICES)
    driver.quit()

def reject_cookies(driver):
    print("INFO: Attempting to reject cookies.")
    try:
        time.sleep(5)
        cookie_button = driver.find_element(By.ID, 'onetrust-reject-all-handler')
        cookie_button.click()
        time.sleep(2)
        print("SUCCESS: Cookies rejected.")
    except Exception as e:
        print(f"ERROR: No cookie button found: {e}")

def scroll_end(driver):
    # https://stackoverflow.com/questions/48850974/selenium-scroll-to-end-of-page-in-dynamically-loading-webpage
    print("INFO: Scrolling to the end of the page.")

    last_height = driver.execute_script("return document.body.scrollHeight")
    i = 0

    while True:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)
        new_height = driver.execute_script("return document.body.scrollHeight")

        if DEBUG_MODE: driver.save_screenshot(f"page_scroll_{i}.png")
        i += 1

        if new_height == last_height: break
        last_height = new_height

def get_grid_links(driver):
    grid_container = driver.find_element(By.CLASS_NAME, 'fr-ec-product-collection')
    print('grid_container:', grid_container)
    grid_items = grid_container.find_elements(By.XPATH, "./div")
    print('grid_items:', grid_items)
    print(f"INFO: Found {len(grid_items)} grid items.")

    links = []
    for item in grid_items:

        link_element = item.find_element(By.TAG_NAME, 'a')
        link = link_element.get_attribute('href')
        links.append(link)
    return links

if __name__ == "__main__":
    main()
