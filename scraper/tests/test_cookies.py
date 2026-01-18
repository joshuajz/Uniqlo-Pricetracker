import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

from main import reject_cookies

UNIQLO_URL = "https://www.uniqlo.com/ca/en/men/tops"
COOKIE_BANNER_ID = "onetrust-banner-sdk"
COOKIE_REJECT_BUTTON_ID = "onetrust-reject-all-handler"


@pytest.fixture
def driver():
    """Create a fresh Chrome driver for each test."""
    opts = Options()
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    # Use incognito to ensure cookie banner appears fresh each time
    opts.add_argument("--incognito")

    driver = webdriver.Chrome(options=opts)
    yield driver
    driver.quit()


def test_cookie_banner_appears_on_fresh_visit(driver):
    """Verify that the cookie consent banner appears on a fresh page visit."""
    driver.get(UNIQLO_URL)

    # Wait for cookie banner to appear (up to 10 seconds)
    wait = WebDriverWait(driver, 10)
    banner = wait.until(
        EC.presence_of_element_located((By.ID, COOKIE_BANNER_ID))
    )

    assert banner.is_displayed(), "Cookie banner should be visible on fresh visit"


def test_reject_cookies_dismisses_banner(driver):
    """Verify that reject_cookies() successfully dismisses the cookie banner."""
    driver.get(UNIQLO_URL)

    # Wait for cookie banner to appear first
    wait = WebDriverWait(driver, 10)
    wait.until(EC.presence_of_element_located((By.ID, COOKIE_BANNER_ID)))

    # Call the function under test
    reject_cookies(driver)

    # Verify the banner is no longer visible
    # The banner may still exist in DOM but should be hidden
    try:
        wait = WebDriverWait(driver, 5)
        wait.until(EC.invisibility_of_element_located((By.ID, COOKIE_BANNER_ID)))
        banner_hidden = True
    except TimeoutException:
        # Check if banner is still displayed
        banner = driver.find_element(By.ID, COOKIE_BANNER_ID)
        banner_hidden = not banner.is_displayed()

    assert banner_hidden, "Cookie banner should be hidden after reject_cookies()"


def test_reject_cookies_allows_page_interaction(driver):
    """Verify that after rejecting cookies, the page content is interactable."""
    driver.get(UNIQLO_URL)

    # Wait for page to load
    wait = WebDriverWait(driver, 10)
    wait.until(EC.presence_of_element_located((By.ID, COOKIE_BANNER_ID)))

    # Reject cookies
    reject_cookies(driver)

    # Wait a moment for the banner to fully dismiss
    wait.until(EC.invisibility_of_element_located((By.ID, COOKIE_BANNER_ID)))

    # Verify we can interact with the product grid
    grid = wait.until(
        EC.presence_of_element_located((By.CLASS_NAME, "fr-ec-product-collection"))
    )

    assert grid is not None, "Should be able to find product grid after dismissing cookies"

    # Try to find product links
    links = grid.find_elements(By.TAG_NAME, "a")
    assert len(links) > 0, "Should find product links in the grid"
