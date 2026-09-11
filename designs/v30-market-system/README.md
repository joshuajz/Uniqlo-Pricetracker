# Market-ready UI design round

Eighteen interactive directions derived from the current React implementation and the local v1, v4, v5, category-page studies, and v27–v29 explorations.

## Shared product rules

- One active market controls catalogue, currency, tax context, timestamps, history, and outbound store links.
- Market context appears once in the header and once near the page title; product rows do not repeat it.
- Search supports product name and style code. Deal browsing remains the default task.
- Cross-market comparison is optional and limited to products matched by a stable style code.
- Prices remain in local currency. Comparison highlights use an exchange-rate estimate and explicitly note that tax varies.
- `GB` is appropriate as an internal ISO market key; the interface displays `UK`.

## Design-system foundation

- Type: Archivo for interface text, Newsreader for selected independent-brand display roles, IBM Plex Mono for prices and market metadata.
- Spacing: a 4px base with compact 44–54px controls and more generous space around results.
- Shapes: square retail controls for the UNIQLO-adjacent family; circles and softened panels for the independent family.
- Signature: a compact market stamp (`CA`, `US`, `UK`, `JP`) that carries market context without explanatory copy.
- Accessibility: keyboard focus, semantic controls, responsive layouts, and reduced-motion support.

## Directions

| # | Direction | Best fit |
|---|---|---|
| 01 | Retail ledger | Lowest-risk evolution of the current app |
| 02 | Campaign grid | Visual deal discovery |
| 03 | Utility catalogue | Maximum desktop scanning density |
| 04 | Redline browse | Bold retail identity built around discount |
| 05 | Product focus | Browse and check one item side-by-side |
| 06 | Price Lens | Independent, scalable product identity |
| 07 | Drop Board | Fast, data-led scanning |
| 08 | Field cards | Friendly, image-forward browsing |
| 09 | Quiet Index | Minimal, typographic price intelligence |
| 10 | Atlas compare | Optional cross-market evaluation |
| 11 | Facet rail | Counted facets and a dense two-column stream |
| 12 | Tag shelves | Full taxonomy visibility without a sidebar |
| 13 | Grouped ledger | Leaf tags as sticky result sections |
| 14 | Compact mosaic | Maximum image-forward density |
| 15 | Command table | Token search and virtualized rows |
| 16 | World table | Bonus: facet-aware country comparison |
| 17 | Uniqlo Tracker | Option 12 with the current app branding and quieter filter grouping |
| 18 | Price Fold | Option 12 with an independent apparel price identity |

## Granular-tag strategy at 242 deals

### Existing directions

| Direction | How tags fit without adding clutter |
|---|---|
| 01 · Retail ledger | Put the full taxonomy in a filter popover; show the leaf category under the name and only expose active tags above results. |
| 02 · Campaign grid | Filter through a compact tag tray; keep one category strap on each card and move material/features into product detail. |
| 03 · Utility catalogue | Extend the existing sidebar into counted category, material, and feature facets; rows retain the category path only. |
| 04 · Redline browse | Keep discount-led rows clean; tags narrow the list from a drawer and appear in detail after selection. |
| 05 · Product focus | Use tags as filters above the left-hand result list and show the full tag set in the persistent detail panel. |
| 06 · Price Lens | Add a collapsible facet tray and show one “why it matched” tag on each card. |
| 07 · Drop Board | Make tags searchable commands and add one short Tag column rather than multiple chips. |
| 08 · Field cards | Use a grouped filter tray above the grid and show one differentiating feature tag at the card foot. |
| 09 · Quiet Index | Keep tags out of the default index; expose the leaf path under the name and reveal matching tags only during filtered searches. |
| 10 · Atlas compare | Apply tags to the selected-market result set first; compare rows retain the leaf category and stable style code. |

### Scale-focused directions

| Direction | How tags work |
|---|---|
| 11 · Facet rail | Category, material, and feature tags become counted sidebar facets; result rows show only the two tags that explain the match. |
| 12 · Tag shelves | The same three tag families stay visible as compact horizontal shelves; each product tile shows one distinguishing tag. |
| 13 · Grouped ledger | Leaf category tags become sticky section headings and jump links, avoiding repeated category chips on every product. |
| 14 · Compact mosaic | A drawer owns the complete taxonomy; tiles expose one discriminating tag and keep imagery, name, and price compact. |
| 15 · Command table | Tags become searchable tokens that can be added and removed from the query; a dedicated Tags column explains matches. |
| 16 · World table | Facets narrow the set before comparison; the product column retains the leaf category and one feature tag beside the style code. |
| 17 · Uniqlo Tracker | Keeps the three visible tag families from Option 12, removes divider rules, and uses the current wordmark and palette. |
| 18 · Price Fold | Uses the same taxonomy and result density as 17, with a folded-label signature and an independent colour system. |

For the production implementation, keep the URL as the source of truth for selected tags, allow multi-select within a family and AND matching across families, and virtualize the result surface rather than paginating away context.

## Recommendation

For the Option 12 route, use **Price Fold** when the product should grow beyond one retailer; use **Uniqlo Tracker** when continuity with the current app is the priority. Keep **World Table** secondary until reliable cross-market product matching and exchange-rate handling exist.
