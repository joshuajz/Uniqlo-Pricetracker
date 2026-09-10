import ast
import unittest
from pathlib import Path

import main


def taxonomy_fixture():
    genders = []
    classes = []
    gender_ids = {"men": 528, "women": 384, "kids": 664}
    next_class_id = 1000
    for gender_key, gender_id in gender_ids.items():
        genders.append({"id": gender_id, "genderKey": gender_key})
        for route in main.CATEGORY_ROUTES:
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


def product_item(product_id, price=24.9, promo=None, price_group="00"):
    return {
        "productId": product_id,
        "name": f"Product {product_id}",
        "priceGroup": price_group,
        "prices": {
            "base": {"currency": {"code": "CAD"}, "value": price},
            "promo": (
                {"currency": {"code": "CAD"}, "value": promo}
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


class ApiScraperTests(unittest.TestCase):
    def test_configures_the_same_23_routes_as_the_browser_scraper(self):
        self.assertEqual(len(main.CATEGORY_ROUTES), 23)
        self.assertEqual(len(set(main.CATEGORY_ROUTES)), 23)
        self.assertEqual(
            {route.split("/", 1)[0] for route in main.CATEGORY_ROUTES},
            {"men", "women", "kids"},
        )

    def test_routes_match_the_legacy_scraper(self):
        legacy_source = Path(__file__).parents[2] / "scraper" / "main.py"
        module = ast.parse(legacy_source.read_text(encoding="utf-8"))
        urls_node = next(
            node.value
            for node in module.body
            if isinstance(node, ast.Assign)
            and any(
                isinstance(target, ast.Name) and target.id == "URLS"
                for target in node.targets
            )
        )
        legacy_routes = [
            url.removeprefix("https://www.uniqlo.com/ca/en/").rstrip("/")
            for url in ast.literal_eval(urls_node)
        ]
        self.assertEqual(list(main.CATEGORY_ROUTES), legacy_routes)

    def test_resolves_every_route_from_live_taxonomy_shape(self):
        categories = main.resolve_categories(taxonomy_fixture())
        self.assertEqual([category.route for category in categories], list(main.CATEGORY_ROUTES))
        self.assertEqual(categories[0].gender_id, 528)
        self.assertEqual(categories[0].class_id, 1000)

    def test_product_query_targets_the_whole_top_level_class(self):
        category = main.Category("men/tops", "men", 528, 546)
        query = main.product_query(category, 100)
        self.assertEqual(query["path"], "528,546,,")
        self.assertEqual(query["genderId"], 528)
        self.assertEqual(query["offset"], 100)
        self.assertEqual(query["rankingClassId"], 546)

    def test_parse_product_uses_promo_price_and_representative_image(self):
        product, image_url = main.parse_product(product_item("E123456-000", promo=19.9))
        self.assertEqual(product["price"], "CA $ 19.90")
        self.assertEqual(
            product["url"],
            "https://www.uniqlo.com/ca/en/products/E123456-000/00",
        )
        self.assertEqual(image_url, "https://example.com/09.jpg")

    def test_scrape_category_paginates_to_total_and_deduplicates_product_id(self):
        category = main.Category("men/tops", "men", 528, 546)
        pages = {
            0: ([product_item("E1"), product_item("E2")], 3),
            2: ([product_item("E1", price_group="01")], 3),
        }
        offsets = []

        def fetcher(_category, offset):
            offsets.append(offset)
            return pages[offset]

        result, images = main.scrape_category(category, page_fetcher=fetcher)
        self.assertEqual(offsets, [0, 2])
        self.assertEqual(result.api_total, 3)
        self.assertEqual([product["product_id"] for product in result.products], ["E1", "E2"])
        self.assertEqual(set(images), {"E1", "E2"})

    def test_scrape_category_rejects_duplicate_listings_between_pages(self):
        category = main.Category("men/tops", "men", 528, 546)
        pages = {
            0: ([product_item("E1"), product_item("E2")], 3),
            2: ([product_item("E1")], 3),
        }

        with self.assertRaisesRegex(RuntimeError, "duplicate listing"):
            main.scrape_category(category, page_fetcher=lambda _category, offset: pages[offset])


if __name__ == "__main__":
    unittest.main()
