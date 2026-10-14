"""Regression coverage for the US taxonomy without the retired Kids class."""

from copy import deepcopy
from dataclasses import replace
import unittest

from core import resolve_categories
from us.config import CONFIG


# Relevant classes from the public US taxonomy on 2026-10-14. Keep this
# independent of CONFIG so adding an unavailable route fails the regression.
CLASSES = {
    "men": (22211, {
        "outerwear-and-blazers": 23304, "tops": 23305,
        "shirts-and-polos": 95669, "sweaters": 95668, "bottoms": 23306,
        "innerwear": 23307, "loungewear-and-home": 23308,
        "accessories-and-shoes": 23309,
    }),
    "women": (22210, {
        "outerwear-and-blazers": 23294, "tops": 23295,
        "shirts-and-blouses": 95663, "sweaters": 95664, "bottoms": 23296,
        "dresses-and-skirts": 23297, "innerwear": 23298,
        "loungewear-and-home": 23299, "accessories-and-shoes": 23300,
        "linen": 81258,
    }),
    "kids": (22212, {
        "outerwear-and-blazers": 23311, "tops": 23312,
        "sweaters": 103469, "shirts-and-blouses": 103470,
        "bottoms": 23313, "innerwear": 23315, "accessories": 23317,
        "girls": 151197,
    }),
    "baby": (22213, {"newborn": 23319, "toddler": 23321}),
}


def taxonomy_fixture():
    return {
        "status": "ok",
        "result": {
            "genders": [
                {"id": gender_id, "genderKey": key}
                for key, (gender_id, _) in CLASSES.items()
            ],
            "classes": [
                {"id": class_id, "key": class_key,
                 "parents": [{"id": gender_id, "key": gender_key}]}
                for gender_key, (gender_id, classes) in CLASSES.items()
                for class_key, class_id in classes.items()
            ],
        },
    }


class USTaxonomyTests(unittest.TestCase):
    def test_current_taxonomy_resolves_all_routes_and_keeps_girls(self):
        categories = resolve_categories(CONFIG, taxonomy_fixture())
        self.assertEqual(len(categories), 28)
        self.assertEqual([c.route for c in categories], list(CONFIG.category_routes))
        girls = next(c for c in categories if c.route == "kids/girls")
        self.assertEqual((girls.gender_id, girls.class_id), (22212, 151197))

    def test_retired_dresses_route_reproduces_original_failure(self):
        original = replace(CONFIG, category_routes=CONFIG.category_routes + ("kids/dresses",))
        with self.assertRaisesRegex(ValueError, "'kids/dresses', found 0"):
            resolve_categories(original, taxonomy_fixture())

    def test_missing_required_girls_class_still_fails(self):
        payload = taxonomy_fixture()
        payload["result"]["classes"] = [
            c for c in payload["result"]["classes"] if c["key"] != "girls"
        ]
        with self.assertRaisesRegex(ValueError, "'kids/girls', found 0"):
            resolve_categories(CONFIG, payload)

    def test_ambiguous_girls_class_still_fails(self):
        payload = taxonomy_fixture()
        girls = next(c for c in payload["result"]["classes"] if c["key"] == "girls")
        payload["result"]["classes"].append(deepcopy(girls))
        with self.assertRaisesRegex(ValueError, "'kids/girls', found 2"):
            resolve_categories(CONFIG, payload)


if __name__ == "__main__":
    unittest.main()
