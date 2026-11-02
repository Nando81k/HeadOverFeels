# Shopify Storefront fixtures

**These files are hand-authored placeholders, not recorded responses.**

Phase 1 Task 0 (the human step that adds the Headless sales channel and issues the
Storefront access tokens) has not happened on the trial store yet, so
`scripts/shopify/record-fixtures.ts` cannot be run. To unblock Phase 1 Tasks 5–7 and
Phase 2 Task 2 the fixtures here were written by hand to match — field for field —
what Storefront API **2026-07** returns for the queries validated in
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
The Phase 2 additions reuse exactly those handles and prices: `search-results.json`
repeats three of the `collection-products.json` nodes, and `collections.json` gained the
`description` field and the `custom.featured` metafield alias (`drops`, `hoodies` and
`tees` are featured).

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
| `search-results.json` | `SEARCH_QUERY` | query `"hoodie"`, `first: 12`, no filters — `productFilters` needs availability, price, the Size/Color options and product type populated |
| `sitemap-products.json` | `SITEMAP_PRODUCTS_QUERY` | `first: 250`, `after: null` — one page (`hasNextPage: false`); handle + `updatedAt` only |
| `sitemap-collections.json` | `SITEMAP_COLLECTIONS_QUERY` | `first: 250`, `after: null` — one page (`hasNextPage: false`); handle + `updatedAt` only |

## Mutation-produced fixtures (not recordable)

`cart.json` (Phase 3, Task 1) is **hand-authored and stays that way**: a cart only exists
after a `cartCreate` mutation, so there is nothing for the read-only recorder to query and
`FIXTURE_QUERIES` has no `cart` entry (the recorder skips it; see the note in
`scripts/shopify/lib/fixture-queries.ts`). The file holds the `data` of a `CartById`
response (`{ "cart": { ... } }`, the `CartFields` selection from
`lib/shopify/queries/cart.ts`):

- two lines — Core Hoodie Taupe / M (qty 1, `88.0`, variant id taken from
  `product-by-handle.json`, product `maxPerOrder` metafield `{ "value": "2" }`) and
  Signature Tee Black / L (qty 1, `24.0` with compare-at `34.0`, `quantityAvailable: 1`
  so the not-enough-stock path has data, `maxPerOrder: null`; the tee variant id is
  invented because no other fixture lists tee variants),
- `discountCodes: [{ "code": "GOLD15", "applicable": true }]` with a single cart-level
  `discountAllocations` entry of `16.8` (15% of the `112.0` subtotal) and empty line-level
  allocations; `totalAmount` / `checkoutChargeAmount` `95.2`,
- `note: ""` (normalised to `null`), `buyerIdentity.email: null`, no customer,
- `gid://shopify/Cart/<token>?key=<key>` / `gid://shopify/CartLine/<uuid>?cart=<token>` ids
  and a `https://tgqucm-qg.myshopify.com/cart/c/<token>?key=<key>` `checkoutUrl`.

To refresh it against the live API, create a cart by hand (GraphiQL or a scratch script
running `CART_CREATE_MUTATION` with the two variant ids and `discountCodes: ["GOLD15"]`)
and paste the `cart` object from the response.
