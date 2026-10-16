# Availability, variants and filter proposal

Reviewed October 15, 2026. Research only: no variant collection or filter taxonomy changes shipped.

## What we can collect

| Information | Evidence | Effort / recommendation |
| --- | --- | --- |
| Colour names and codes | Public listing responses in CA, US, UK and JP contain `colors`, including `code`, `displayCode`, `name` and `filterCode`. | Low. Preserve fields from requests we already make. Show “Listed colours”, not “Available colours”. |
| Size labels and codes | All four samples contain `sizes`. | Low. Preserve from listing responses. Lists do not prove that every colour/size combination is in stock. |
| Representative variant and length | `representative` includes `l2Id`, `color`, `size`, `pld` and `sales`; listings also have `plds`. | Moderate. Preserve variant identity alongside the product ID and market. A representative variant is not a complete variant matrix. |
| Prices that differ by variant | Listing results include `priceGroup` and `prices`; the storefront advertises “Select Colours/Sizes Only” on some deals. | Moderate. Keep the price group and its associated variants. Do not imply that one recorded price applies to every colour and size. |
| Online stock by colour and size | On the Canadian Soft Brushed Crew Neck T-Shirt page, dark brown XXS was marked out of stock while S was in stock; changing to white changed the size choices. | Further investigation needed. The UI proves stock exists, but no stable reusable stock endpoint was validated in this review. Sample each market and validate meanings, caching and failure states before implementation. |
| Local store stock | The Canadian page has “Select a store” and “Check additional stores”. | Higher effort. Requires store context and more requests. Defer until online availability works reliably. |

Public samples checked:

- CA: [Soft Brushed Crew Neck T-Shirt, E450179-000](https://www.uniqlo.com/ca/en/products/E450179-000/00) — 8 listed colours, 7 sizes; CAD 29.90 in the sampled listing response.
- UK: [AIRism Cotton Oversized T-Shirt, E465185-000](https://www.uniqlo.com/uk/en/products/E465185-000/00) — 13 listed colours, 7 sizes.
- JP: [E469956-000](https://www.uniqlo.com/jp/ja/products/E469956-000/00) — 9 listed colours, 8 sizes.
- US: [SUPIMA Cotton T-Shirt, E455365-000](https://www.uniqlo.com/us/en/products/E455365-000/00) — same colour/size/representative field structure.

These are samples, not a guarantee that every product or region supplies every field. The storefront APIs are implementation details and can change.

## Important data-model detail

`scraper/core.py` currently discards these extra fields in `parse_product` and collapses results by product ID. Listing validation already recognizes `(productId, priceGroup)` as the unique listing key. Adding colour names alone is straightforward; trustworthy variant price comparisons need us to retain price groups and variant associations before deduplication. Do not generate a Cartesian product of all listed colours and sizes.

Recommended order:

1. Preserve listed colours, sizes, length options and price groups in a separate metadata structure, keyed by market/product, without changing historical product prices.
2. Show listed options with a recording date and a clear “Check current availability at Uniqlo” link. Use “Prices may vary by colour and size” where supported by price groups.
3. Validate inventory requests and identifiers on representative products in every market. Add a timestamped, cached online stock snapshot only once missing / unknown / out-of-stock states are distinguishable.
4. Keep daily price history separate from stock snapshots. Archived means absent from the latest catalogue, not definitively sold out or discontinued. Daily stock data must not be described as live.

No historical colour/size availability can be reconstructed from the existing stored prices alone. Storing the listing metadata adds little request volume; recording stock for each variant could multiply requests substantially, depending on whether a product-level stock response is available.

## Scraper issue found during research

The US configuration includes `kids/dresses`, which was absent from the live US taxonomy in this check. Full `resolve_categories` raised an error. The US sample above was fetched with a limited `men/tops` configuration for research only. The checked-in category configuration was left untouched. Resolve this route against the live taxonomy before relying on a complete US import; do not silently drop the category or assume it means zero stock.

## Filter proposal — not implemented

See `mockups/filter-proposal.html` and screenshots in `mockups/review-assets`.

- Merge **Innerwear** and **Innerwear and base layers** into **Innerwear & base layers**.
- Merge **Loungewear** and **Loungewear and homeware** into **Loungewear & homewear**.
- Present one group as **Product type**, keeping **Material** and **Feature** separate. Only merge other labels after checking that their memberships have equivalent meaning; “Accessories and home” is broader than “Accessories”.
- On mobile, use collapsible groups with selected counts. Keep Product type open initially, show selected filters together, and retain the new sticky results button. It applies no new filtering rule: selections still update results immediately.
- Keep budget inputs visible, with advanced discount/saving controls in a disclosure if space is tight. Retain exact numeric input and current Typical-price explanation.
- Calculate counts from unique product IDs, taking the union of merged categories. Preserve old URL values as aliases so shared links keep working.

The mockups use illustrative counts to explain the interaction; they are not live catalogue totals. These proposals should be checked in each country before implementation because taxonomy names differ.
