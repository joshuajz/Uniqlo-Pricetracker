import json
import io
import tempfile
import unittest
import zipfile
from pathlib import Path
from dataclasses import replace
from unittest.mock import patch

from canada.config import CONFIG as CANADA
from core import (
    Category,
    ScraperSettings,
    add_images,
    existing_image_ids,
    create_archive,
    current_price,
    parse_product,
    product_query,
    resolve_categories,
    scrape_category,
)
from japan.config import CONFIG as JAPAN
from uk.config import CONFIG as UK
from us.config import CONFIG as US


MARKETS = (CANADA, UK, JAPAN, US)


def taxonomy_fixture(config):
    genders = []
    classes = []
    gender_ids = {"men": 10, "women": 20, "kids": 30, "baby": 40}
    next_class_id = 1000
    for gender_key, gender_id in gender_ids.items():
        genders.append({"id": gender_id, "genderKey": gender_key})
        for route in config.category_routes:
            route_gender, class_key = route.split("/", 1)
            if route_gender == gender_key:
                classes.append(
                    {
                        "id": next_class_id,
                        "key": class_key,
                        "parents": [{"id": gender_id, "key": gender_key}],
                    }
                )
                next_class_id += 1
    return {"status": "ok", "result": {"genders": genders, "classes": classes}}


def product_item(config, product_id, price=24.9, promo=None, price_group="00"):
    return {
        "productId": product_id,
        "name": f"Product {product_id}",
        "priceGroup": price_group,
        "prices": {
            "base": {"currency": {"code": config.currency_code}, "value": price},
            "promo": (
                {
                    "currency": {"code": config.currency_code},
                    "value": promo,
                }
                if promo is not None
                else None
            ),
        },
        "representativeColorDisplayCode": "09",
        "images": {
            "main": {
                "00": {"image": "https://example.com/00.jpg"},
                "09": {"image": "https://example.com/09.jpg"},
            }
        },
    }


class MarketConfigTests(unittest.TestCase):
    def test_market_routes_are_unique_and_resolve(self):
        for config in MARKETS:
            with self.subTest(market=config.market_code):
                self.assertEqual(
                    len(config.category_routes), len(set(config.category_routes))
                )
                self.assertEqual(
                    {route.split("/", 1)[0] for route in config.category_routes},
                    {"men", "women", "kids", "baby"},
                )
                categories = resolve_categories(config, taxonomy_fixture(config))
                self.assertEqual(
                    [category.route for category in categories],
                    list(config.category_routes),
                )

    def test_regional_api_settings(self):
        self.assertEqual(CANADA.client_id, "uq.ca.web-spa")
        self.assertEqual(UK.client_id, "uq.gb.web-spa")
        self.assertEqual(US.client_id, "uq.us.web-spa")
        self.assertEqual(JAPAN.client_id, "uq.jp.web-spa")
        self.assertEqual(
            {config.currency_code for config in MARKETS},
            {"CAD", "GBP", "JPY", "USD"},
        )


class ApiScraperTests(unittest.TestCase):
    def test_product_query_targets_whole_top_level_class(self):
        category = Category("men/tops", "men", 528, 546)
        query = product_query(category, 100, 80)
        self.assertEqual(query["path"], "528,546,,")
        self.assertEqual(query["genderId"], 528)
        self.assertEqual(query["offset"], 100)
        self.assertEqual(query["limit"], 80)
        self.assertEqual(query["rankingClassId"], 546)

    def test_formats_each_market_currency(self):
        self.assertEqual(current_price(CANADA, product_item(CANADA, "E1")), "CA $ 24.90")
        self.assertEqual(current_price(UK, product_item(UK, "E1")), "£24.90")
        self.assertEqual(current_price(US, product_item(US, "E1")), "$24.90")
        self.assertEqual(
            current_price(JAPAN, product_item(JAPAN, "E1", price=1990)),
            "¥1,990",
        )

    def test_parse_product_uses_promo_price_and_representative_image(self):
        product, image_url = parse_product(
            UK, product_item(UK, "E123456-000", promo=19.9)
        )
        self.assertEqual(product["price"], "£19.90")
        self.assertEqual(
            product["url"],
            "https://www.uniqlo.com/uk/en/products/E123456-000/00",
        )
        self.assertEqual(image_url, "https://example.com/09.jpg")

    def test_scrape_category_paginates_and_deduplicates_product_id(self):
        category = Category("men/tops", "men", 528, 546)
        pages = {
            0: ([product_item(CANADA, "E1"), product_item(CANADA, "E2")], 3),
            2: ([product_item(CANADA, "E1", price_group="01")], 3),
        }
        offsets = []

        def fetcher(_category, offset):
            offsets.append(offset)
            return pages[offset]

        result, images = scrape_category(
            CANADA, category, page_fetcher=fetcher
        )
        self.assertEqual(offsets, [0, 2])
        self.assertEqual(result.api_total, 3)
        self.assertEqual(
            [product["product_id"] for product in result.products], ["E1", "E2"]
        )
        self.assertEqual(set(images), {"E1", "E2"})

    def test_scrape_category_rejects_duplicate_listings_between_pages(self):
        category = Category("men/tops", "men", 528, 546)
        pages = {
            0: ([product_item(CANADA, "E1"), product_item(CANADA, "E2")], 3),
            2: ([product_item(CANADA, "E1")], 3),
        }

        with self.assertRaisesRegex(RuntimeError, "duplicate listing"):
            scrape_category(
                CANADA,
                category,
                page_fetcher=lambda _category, offset: pages[offset],
            )

    def test_scrape_category_accepts_empty_category(self):
        category = Category("kids/dresses", "kids", 22212, 23314)

        result, images = scrape_category(
            US,
            category,
            page_fetcher=lambda _category, _offset: ([], 0),
        )

        self.assertEqual(result.route, "kids/dresses")
        self.assertEqual(result.products, [])
        self.assertEqual(result.api_total, 0)
        self.assertEqual(images, {})

    def test_scrape_category_rejects_products_with_zero_total(self):
        category = Category("kids/dresses", "kids", 22212, 23314)

        with self.assertRaisesRegex(RuntimeError, "products with a zero total"):
            scrape_category(
                US,
                category,
                page_fetcher=lambda _category, _offset: (
                    [product_item(US, "E1")],
                    0,
                ),
            )

    def test_archive_records_market_and_currency(self):
        prices = {
            "men/tops": [
                {
                    "product_id": "E1",
                    "name": "Product E1",
                    "price": "£19.90",
                    "url": "https://www.uniqlo.com/uk/en/products/E1/00",
                    "image": None,
                }
            ]
        }
        with tempfile.TemporaryDirectory() as temporary_directory:
            output_dir = Path(temporary_directory)
            create_archive(UK, output_dir, prices, 0, 1.25)
            payload = json.loads((output_dir / "prices.json").read_text())
            self.assertEqual(payload["metadata"]["market"], "GB")
            self.assertEqual(payload["metadata"]["currency"], "GBP")
            with zipfile.ZipFile(output_dir / "output.zip") as archive:
                self.assertEqual(archive.namelist(), ["prices.json"])


class ProductImageTests(unittest.TestCase):
    def setUp(self):
        self.settings = replace(ScraperSettings.from_env(1), save_photo=False, save_missing_photo=True)
        self.prices = {
            "men/tops": [{"product_id": "E1", "image": None}, {"product_id": "E2", "image": None}],
            "women/tops": [{"product_id": "E2", "image": None}],
        }
        self.urls = {"E1": "https://example.com/1.jpg", "E2": "https://example.com/2.jpg"}

    def test_daily_downloads_only_missing_images_once_and_attaches_all_occurrences(self):
        with tempfile.TemporaryDirectory() as directory, patch("core.existing_image_ids", return_value={"E1"}), patch(
            "core.download_product_image", return_value="images/E2.jpg"
        ) as download:
            self.assertEqual(add_images(CANADA, self.settings, Path(directory), self.prices, self.urls), 0)
            download.assert_called_once_with(CANADA, self.settings, Path(directory), "E2", self.urls["E2"])
        self.assertIsNone(self.prices["men/tops"][0]["image"])
        self.assertEqual(self.prices["men/tops"][1]["image"], "images/E2.jpg")
        self.assertEqual(self.prices["women/tops"][0]["image"], "images/E2.jpg")

    def test_monthly_refresh_downloads_existing_images_without_inventory_lookup(self):
        settings = replace(self.settings, save_photo=True)
        with tempfile.TemporaryDirectory() as directory, patch("core.existing_image_ids") as inventory, patch(
            "core.download_product_image", side_effect=lambda *args: f"images/{args[3]}.jpg"
        ) as download:
            self.assertEqual(add_images(CANADA, settings, Path(directory), self.prices, self.urls), 0)
            self.assertEqual(download.call_count, 2)
            inventory.assert_not_called()

    def test_no_missing_images_skips_downloads(self):
        with tempfile.TemporaryDirectory() as directory, patch("core.existing_image_ids", return_value=set(self.urls)), patch(
            "core.download_product_image"
        ) as download:
            self.assertEqual(add_images(CANADA, self.settings, Path(directory), self.prices, self.urls), 0)
            download.assert_not_called()

    def test_inventory_outage_falls_back_to_all_images(self):
        with tempfile.TemporaryDirectory() as directory, patch("core.existing_image_ids", side_effect=OSError("offline")), patch(
            "core.download_product_image", side_effect=lambda *args: f"images/{args[3]}.jpg"
        ) as download:
            self.assertEqual(add_images(CANADA, self.settings, Path(directory), self.prices, self.urls), 0)
            self.assertEqual(download.call_count, 2)

    def test_failed_missing_image_is_retried_next_run(self):
        with tempfile.TemporaryDirectory() as directory, patch("core.existing_image_ids", return_value={"E1"}), patch(
            "core.download_product_image", side_effect=[OSError("offline"), "images/E2.jpg"]
        ) as download:
            self.assertEqual(add_images(CANADA, self.settings, Path(directory), self.prices, self.urls), 1)
            self.assertIsNone(self.prices["men/tops"][1]["image"])
            self.assertEqual(add_images(CANADA, self.settings, Path(directory), self.prices, self.urls), 0)
            self.assertEqual(download.call_count, 2)

    def test_inventory_request_is_market_scoped_and_validated(self):
        for config in MARKETS:
            with self.subTest(market=config.market_code), patch.dict("os.environ", {"API_URL": "https://tracker.example/"}), patch(
                "core.urllib.request.urlopen", return_value=io.BytesIO(json.dumps({"market": config.market_code, "product_ids": ["E1"]}).encode())
            ) as request:
                self.assertEqual(existing_image_ids(config, self.settings), {"E1"})
                self.assertEqual(request.call_args.args[0].full_url, f"https://tracker.example/api/{config.market_code.lower()}/product-images")
        for payload in ([], None, {"market": "US", "product_ids": ["E1"]}, {"market": "CA"}, {"market": "CA", "product_ids": [1]}):
            with patch("core.urllib.request.urlopen", return_value=io.BytesIO(json.dumps(payload).encode())):
                with self.assertRaises(ValueError):
                    existing_image_ids(CANADA, self.settings)


if __name__ == "__main__":
    unittest.main()
