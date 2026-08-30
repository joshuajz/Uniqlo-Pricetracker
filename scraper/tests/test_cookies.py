import pytest

from main import (
    choose_image_url,
    extract_price,
    extract_product_id,
    get_proxy_config,
    normalize_product_url,
)


def test_extracts_listing_card_fields():
    url = normalize_product_url(
        "/ca/en/products/E465185-000/00?colorDisplayCode=00"
    )
    assert url == (
        "https://www.uniqlo.com/ca/en/products/"
        "E465185-000/00?colorDisplayCode=00"
    )
    assert extract_product_id(url) == "E465185-000"
    assert extract_price("Sale\nCA  $   19.90\nLimited offer") == "CA $ 19.90"


def test_extract_price_rejects_missing_price():
    with pytest.raises(ValueError, match="Canadian price"):
        extract_price("Coming soon")


def test_choose_image_url_prefers_product_image():
    product_image = (
        "https://image.uniqlo.com/UQ/ST3/ca/imagesgoods/465185/item/"
        "cagoods_00_465185_3x4.jpg?width=300"
    )
    assert choose_image_url(
        [("https://example.com/chip.jpg", None), (None, product_image)]
    ) == product_image


def test_proxy_config_is_optional(monkeypatch):
    monkeypatch.delenv("PROXY_SERVER", raising=False)
    monkeypatch.delenv("PROXY_USERNAME", raising=False)
    monkeypatch.delenv("PROXY_PASSWORD", raising=False)
    assert get_proxy_config() is None


def test_proxy_config_supports_authentication(monkeypatch):
    monkeypatch.setenv("PROXY_SERVER", "http://proxy.example:7000")
    monkeypatch.setenv("PROXY_USERNAME", "user-name")
    monkeypatch.setenv("PROXY_PASSWORD", "secret")
    assert get_proxy_config() == {
        "server": "http://proxy.example:7000",
        "username": "user-name",
        "password": "secret",
    }
