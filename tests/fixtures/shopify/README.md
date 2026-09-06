# Shopify Storefront fixtures

**These files are hand-authored placeholders, not recorded responses.**

Phase 1 Task 0 (the human step that adds the Headless sales channel and issues the
Storefront access tokens) has not happened on the trial store yet, so
`scripts/shopify/record-fixtures.ts` cannot be run. To unblock Tasks 5–7 the seven
fixtures here were written by hand to match — field for field — what Storefront API
**2026-07** returns for the queries validated in
`docs/superpowers/plans/2026-09-06-storefront-rebuild-phase1-foundation.md`
("Shared contracts"), including:

- the PDP `gallery: images(first: 12)` alias and the `colorHex` / `materials` /
  `careGuide` / `dropStart` / `dropEnd` / `maxPerOrder` metafield aliases,
- `nodes` connection arrays (no `edges`),
- `MoneyV2.amount` as a decimal string (`"88.0"`), `compareAtPriceRange.minVariantPrice`
  reported as `"0.0"` when only some variants carry a compare-at price,
- `gid://shopify/...` global ids and `https://cdn.shopify.com/s/files/1/...` image urls,
- metafield `value` as a string: `rich_text_field` as a JSON document string
  (`{"type":"root","children":[...]}`), `date_time` as an ISO 8601 string,
  `number_integer` as a numeric string,
- menu item `url` as an **absolute** `https://tgqucm-qg.myshopify.com/...` url, which is
  what `normalizeMenu` has to rewrite.

The catalog data mirrors the Head Over Feels catalog seeded by Task 4: `core-hoodie`,
`drop-01-heavyweight-crew`, `signature-tee`, `box-logo-tee`; collections `all`,
`hoodies`, `tees`, `drops`, `best-sellers`; shop "Head Over Feels" on
`https://tgqucm-qg.myshopify.com` with the `main-menu` and the four policies.

## Re-record these once the tokens exist

After Task 0 is done and `.env.shopify` has real tokens:

```bash
npx tsx scripts/shopify/record-fixtures.ts --apply
```

The recorder runs every entry of the `FIXTURE_QUERIES` registry
(`scripts/shopify/lib/fixture-queries.ts`) against the store and overwrites these files
with the raw response `data`. Any normaliser test that then fails is a real mismatch
between these placeholders and the live API — fix the fixture expectations, not the
recording.

| file | query | notes for re-recording |
| --- | --- | --- |
| `product-by-handle.json` | `PRODUCT_BY_HANDLE_QUERY` | handle `core-hoodie` — needs 2+ colours, a compare-at price on some variants, and one sold-out variant |
| `collection-products.json` | `COLLECTION_PRODUCTS_QUERY` | handle `all`, `first: 12`, `filters: [{ available: true }]` so filter values are populated |
| `collections.json` | `COLLECTIONS_QUERY` | `first: 50` |
| `shop-layout.json` | `SHOP_LAYOUT_QUERY` | needs the `main-menu` with one nested child list |
| `policies.json` | `POLICIES_QUERY` | all four policies must be published |
| `predictive-search.json` | `PREDICTIVE_SEARCH_QUERY` | query `"hoodie"` |
| `recommendations.json` | `RECOMMENDATIONS_QUERY` | handle `core-hoodie` (Shopify needs order history before this returns anything) |
