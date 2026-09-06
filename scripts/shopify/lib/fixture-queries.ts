/**
 * Registry of Storefront API documents recorded into tests/fixtures/shopify (Phase 1, Task 4).
 *
 * Fixtures are recorded, never invented (plan, cross-cutting note 6). Tasks 5–7 own the real
 * query modules under lib/shopify/queries/* and APPEND their entries here, then re-run
 * `npx tsx scripts/shopify/record-fixtures.ts --only <name>` for their own fixtures.
 *
 * To add an entry:
 *   'product-by-handle': {
 *     query: PRODUCT_BY_HANDLE_QUERY,                       // import the module's exported string
 *     variables: (ctx) => ({ handle: ctx.productHandle }),  // or a plain object when static
 *   }
 *
 * The entry key is the fixture filename: `tests/fixtures/shopify/<key>.json`, holding the raw
 * response `data`. Documents target Storefront API 2026-07.
 */

/** Real handles from the migrated store, passed to every variables factory. */
export interface FixtureQueryContext {
  productHandle: string
  collectionHandle: string
}

export interface FixtureQuery {
  query: string
  variables?: Record<string, unknown> | ((ctx: FixtureQueryContext) => Record<string, unknown>)
}

const SHOP_LAYOUT_QUERY = /* GraphQL */ `
  query ShopLayout {
    shop {
      name
      description
      primaryDomain {
        url
      }
      privacyPolicy {
        handle
        title
      }
      termsOfService {
        handle
        title
      }
      refundPolicy {
        handle
        title
      }
      shippingPolicy {
        handle
        title
      }
    }
    menu(handle: "main-menu") {
      items {
        id
        title
        url
        type
        resourceId
        items {
          id
          title
          url
          type
          resourceId
        }
      }
    }
  }
`

const POLICIES_QUERY = /* GraphQL */ `
  query Policies {
    shop {
      privacyPolicy {
        handle
        title
        body
      }
      termsOfService {
        handle
        title
        body
      }
      refundPolicy {
        handle
        title
        body
      }
      shippingPolicy {
        handle
        title
        body
      }
    }
  }
`

export const FIXTURE_QUERIES: Record<string, FixtureQuery> = {
  'shop-layout': { query: SHOP_LAYOUT_QUERY },
  policies: { query: POLICIES_QUERY },
}
