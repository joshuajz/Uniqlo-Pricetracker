"""Validate one regional Uniqlo storefront API with a two-product request."""

from __future__ import annotations

import argparse
import importlib
import json
from dataclasses import replace

from core import (
    ScraperSettings,
    fetch_product_page,
    parse_product,
    request_json,
    resolve_categories,
)


MARKETS = ("canada", "uk", "japan", "us")


def load_config(market: str):
    return importlib.import_module(f"{market}.config").CONFIG


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("market", choices=MARKETS)
    args = parser.parse_args()

    config = load_config(args.market)
    settings = replace(
        ScraperSettings.from_env(config.default_min_products),
        page_size=2,
    )
    categories = resolve_categories(
        config,
        request_json(config, settings, config.taxonomy_api_url),
    )
    category = next(
        (item for item in categories if item.route == "men/tops"),
        categories[0],
    )
    items, total = fetch_product_page(config, settings, category, 0)
    if not items or total < len(items):
        raise RuntimeError("product API returned an invalid sample")
    sample, image_url = parse_product(config, items[0])
    summary = {
        "market": config.market_code,
        "currency": config.currency_code,
        "categories_resolved": len(categories),
        "sample_category": category.route,
        "sample_category_total": total,
        "sample_product_id": sample["product_id"],
        "sample_name": sample["name"],
        "sample_price": sample["price"],
        "sample_has_image": bool(image_url),
    }
    print(f"PASS: Uniqlo {config.name} API returned usable data")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
