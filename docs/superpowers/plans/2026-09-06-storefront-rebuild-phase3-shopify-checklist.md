# Phase 3 — Shopify checkout checklist (HUMAN)

**Owner:** Nando. Needed before the cart → checkout flow can be tested end to end. Nothing below has an API on the trial store except the branding script in the last section.

## Credentials (Phase 1 Task 0)

- [ ] `.env.shopify` exists locally with `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`, `NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN` and `SHOPIFY_ADMIN_ACCESS_TOKEN` (see `.env.shopify.example`). Never commit it.
- [ ] Headless channel → Storefront API access includes **checkouts/carts read + write** (cart mutations fail without it).
- [ ] "HOF Ops" app (Settings → Apps and sales channels → Develop apps) has the extra Admin scopes `read_checkout_branding_settings write_checkout_branding_settings`. Save, then update/reinstall the app when prompted (re-copy the Admin token if it changes).

## Payments

- [ ] Settings → Payments → add/activate **"(for testing) Bogus Gateway"** (if Shopify Payments is active, deactivate it or use its test mode first). Test checkout: any name, expiry in the future, any CVV, card number `1` = approved, `2` = declined, `3` = gateway failure.
- [ ] Settings → Payments → **Shop Pay**: enable it, then Sales channels → Headless → "Head Over Feels web" → confirm Shop Pay is available to the Headless storefront (the cart's Shop Pay button needs both).
- [ ] Real payments need the plan upgrade (trial stores only take Bogus Gateway orders). Deactivate Bogus Gateway before launch.

## Checkout look

- [ ] Settings → Checkout → **Customize**: upload the logo (header) and the favicon. The Admin API cannot upload files on the trial store.
- [ ] In the same editor, check the header cart link / "Continue shopping" goes back to the storefront domain (Settings → Domains primary domain, or the Headless storefront URL), not the Online Store theme.
- [ ] Settings → Notifications → Abandoned checkout: enabled (Phase 3 relies on Shopify's email).

## Branding script

Applies colours, fonts (Inter body, Archivo uppercase headings), 2px corners and the header layout to the published checkout profile.

```bash
npx tsx scripts/shopify/checkout-branding.ts            # dry run (default): lists checkout profiles if reachable + prints the input JSON
npx tsx scripts/shopify/checkout-branding.ts --apply    # upserts the branding on the published profile
```

- [ ] Run the dry run; confirm the published profile name.
- [ ] Run `--apply`; expect `applied to <profile name>`. Any `userErrors` are printed with their codes.
- [ ] The Checkout Branding API requires a **Plus or development store plan**. If `--apply` is refused (access denied / plan error), set the same values by hand in the checkout editor: colours from the dry-run JSON, Inter + Archivo fonts, the smallest corner radius, headings uppercase.
- [ ] Open a cart's `checkoutUrl` and compare against the storefront: ink buttons, bone background, signal-red accent.

## Smoke test

- [ ] Add to cart on the preview → Checkout → pay with Bogus card `1` → order appears in Orders with the line items and discount.
- [ ] Repeat with card `2` → declined message, no order.
- [ ] Shop Pay button opens Shop Pay with the same cart.
