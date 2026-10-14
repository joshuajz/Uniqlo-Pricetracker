# US scraper

Uses Uniqlo's US English storefront API with 28 men, women, kids, and baby categories.
Prices are emitted in USD, such as `$24.90`.

Kids' dresses and skirts are covered by `kids/girls`; the storefront no longer
exposes a separate top-level `kids/dresses` class.

From the parent `scraper` directory, run:

```bash
python us/main.py
```
