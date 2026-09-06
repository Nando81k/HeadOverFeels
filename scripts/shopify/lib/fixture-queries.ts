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

// The query modules below sit next to `lib/shopify/client.ts`, which imports the
// `server-only` marker package. Run the recorder with the react-server resolution
// condition so that package resolves to its empty build:
//
//   npx tsx --conditions=react-server scripts/shopify/record-fixtures.ts --apply
//
// Without it Node throws "This module cannot be imported from a Client Component module".
import { COLLECTION_PRODUCTS_QUERY } from '../../../lib/shopify/queries/collection'
import { COLLECTIONS_QUERY } from '../../../lib/shopify/queries/collections'
import { PRODUCT_BY_HANDLE_QUERY } from '../../../lib/shopify/queries/product'
import { RECOMMENDATIONS_QUERY } from '../../../lib/shopify/queries/recommendations'
import { PREDICTIVE_SEARCH_QUERY, SEARCH_QUERY } from '../../../lib/shopify/queries/search'
import {
  SITEMAP_COLLECTIONS_QUERY,
  SITEMAP_PRODUCTS_QUERY,
} from '../../../lib/shopify/queries/sitemap'

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
  // Task 5
  'product-by-handle': {
    query: PRODUCT_BY_HANDLE_QUERY,
    variables: (ctx) => ({ handle: ctx.productHandle }),
  },
  // Task 6 — `filters` keeps the recorded filter values non-empty.
  'collection-products': {
    query: COLLECTION_PRODUCTS_QUERY,
    variables: (ctx) => ({
      handle: ctx.collectionHandle,
      first: 12,
      after: null,
      filters: [{ available: true }],
      sortKey: 'BEST_SELLING',
      reverse: false,
    }),
  },
  collections: { query: COLLECTIONS_QUERY, variables: { first: 50 } },
  // Task 7
  'predictive-search': { query: PREDICTIVE_SEARCH_QUERY, variables: { q: 'hoodie' } },
  recommendations: {
    query: RECOMMENDATIONS_QUERY,
    variables: (ctx) => ({ handle: ctx.productHandle }),
  },
  // Phase 2, Task 2
  'search-results': {
    query: SEARCH_QUERY,
    variables: {
      q: 'hoodie',
      first: 12,
      after: null,
      filters: null,
      sortKey: 'RELEVANCE',
      reverse: false,
    },
  },
  'sitemap-products': { query: SITEMAP_PRODUCTS_QUERY, variables: { first: 250, after: null } },
  'sitemap-collections': {
    query: SITEMAP_COLLECTIONS_QUERY,
    variables: { first: 250, after: null },
  },
}
