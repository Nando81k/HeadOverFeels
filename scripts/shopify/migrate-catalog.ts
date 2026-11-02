/**
 * Prisma → Shopify catalog migration (Phase 1, Task 4 Step 5).
 *
 *   npx tsx scripts/shopify/migrate-catalog.ts             # dry run (default), NO mutations
 *   npx tsx scripts/shopify/migrate-catalog.ts --apply     # writes to the Shopify store
 *   npx tsx scripts/shopify/migrate-catalog.ts --apply --limit 3   # first N products only
 *
 * Flow: locations → products (`productByIdentifier` lookup, then async `productSet` at
 * concurrency 3 + `productOperation` polling) → collections (`collectionByIdentifier` /
 * `collectionCreate` + `collectionAddProductsV2`, plus the smart `drops` collection and the
 * manual, empty `best-sellers`) → `publishablePublish` to the `Online Store` and `Headless`
 * publications → `scripts/shopify/out/id-map.json` + a summary.
 *
 * Idempotent: products are matched by handle (`slug`), collections by handle; re-running
 * updates in place. Safe to re-run before cutover.
 *
 * !! API VERSION: every GraphQL document below targets Admin API 2026-07. They were checked
 * !! against the Admin schema with the Shopify MCP `validate_graphql_codeblocks` tool on
 * !! 2026-09-06 (all valid), but have never been executed. Re-validate against the store's own
 * !! API version BEFORE the first `--apply` run, and run `--apply` on a handful of products
 * !! first (`--limit 3`). Known sharp edge: `ProductVariantSetInput.optionValues` is non-null
 * !! in the schema, so a product with no Size/Color options may need an explicit
 * !! `[{ optionName: 'Title', name: 'Default Title' }]` — see build-product-set-input.ts.
 *
 * Requires `.env.shopify` (SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN) and DATABASE_URL.
 * Tokens are never printed.
 */
import './lib/load-env'

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { PrismaClient } from '@prisma/client'

import {
  buildProductSetInput,
  type MigrationProduct,
  type ProductSetInput,
} from './lib/build-product-set-input'
import { flagValue, isApply, loadAdminClient, loadAdminEnv } from './lib/load-env'
import { pollProductOperation, type AdminRequestFn } from './lib/poll-product-operation'

// ---------------------------------------------------------------------------
// GraphQL documents (Admin API 2026-07)
// ---------------------------------------------------------------------------

const LOCATIONS_QUERY = /* GraphQL */ `
  query MigrationLocations {
    locations(first: 20, includeInactive: false) {
      nodes {
        id
        name
        shipsInventory
      }
    }
  }
`

const PRODUCT_BY_HANDLE_QUERY = /* GraphQL */ `
  query MigrationProductByHandle($handle: String!) {
    productByIdentifier(identifier: { handle: $handle }) {
      id
      handle
    }
  }
`

const PRODUCT_SET_MUTATION = /* GraphQL */ `
  mutation MigrationProductSet($input: ProductSetInput!) {
    productSet(synchronous: false, input: $input) {
      productSetOperation {
        id
        status
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

const COLLECTION_BY_HANDLE_QUERY = /* GraphQL */ `
  query MigrationCollectionByHandle($handle: String!) {
    collectionByIdentifier(identifier: { handle: $handle }) {
      id
      handle
      title
    }
  }
`

const COLLECTION_CREATE_MUTATION = /* GraphQL */ `
  mutation MigrationCollectionCreate($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection {
        id
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
`

const COLLECTION_ADD_PRODUCTS_MUTATION = /* GraphQL */ `
  mutation MigrationCollectionAddProducts($id: ID!, $productIds: [ID!]!) {
    collectionAddProductsV2(id: $id, productIds: $productIds) {
      job {
        id
        done
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

// `Publication.name` is deprecated in favour of `Catalog.title`; both are selected so the
// name match keeps working on either side of the deprecation.
const PUBLICATIONS_QUERY = /* GraphQL */ `
  query MigrationPublications {
    publications(first: 20) {
      nodes {
        id
        name
        catalog {
          title
        }
      }
    }
  }
`

const PUBLISHABLE_PUBLISH_MUTATION = /* GraphQL */ `
  mutation MigrationPublishablePublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface LocationsResponse {
  locations: { nodes: { id: string; name: string; shipsInventory: boolean }[] }
}

interface ProductByHandleResponse {
  productByIdentifier: { id: string; handle: string } | null
}

interface ProductSetResponse {
  productSet: {
    productSetOperation: { id: string; status: string } | null
    userErrors: { field?: string[] | null; message: string; code?: string | null }[]
  }
}

interface CollectionByHandleResponse {
  collectionByIdentifier: { id: string; handle: string; title: string } | null
}

interface CollectionCreateResponse {
  collectionCreate: {
    collection: { id: string; handle: string } | null
    userErrors: { field?: string[] | null; message: string }[]
  }
}

interface CollectionAddProductsResponse {
  collectionAddProductsV2: {
    job: { id: string; done: boolean } | null
    userErrors: { field?: string[] | null; message: string; code?: string | null }[]
  }
}

interface PublicationsResponse {
  publications: { nodes: { id: string; name: string; catalog: { title: string } | null }[] }
}

interface PublishablePublishResponse {
  publishablePublish: { userErrors: { field?: string[] | null; message: string }[] }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const OUT_DIR = path.join('scripts', 'shopify', 'out')
const ID_MAP_PATH = path.join(OUT_DIR, 'id-map.json')
const PLACEHOLDER_LOCATION_ID = 'gid://shopify/Location/DRY_RUN'
const PUBLICATION_NAMES = ['Online Store', 'Headless'] as const
const CONCURRENCY = 3

interface ProductIdMapEntry {
  prismaProductId: string
  shopifyProductId: string
  handle: string
  variants: { prismaVariantId: string | null; shopifyVariantId: string; sku: string | null }[]
}

interface CollectionIdMapEntry {
  prismaCollectionId: string | null
  shopifyCollectionId: string
  handle: string
}

interface IdMap {
  generatedAt: string
  storeDomain: string
  locationId: string
  products: ProductIdMapEntry[]
  collections: CollectionIdMapEntry[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Plain text becomes one paragraph; anything already containing markup passes through. */
function toDescriptionHtml(description: string | null): string {
  const text = (description ?? '').trim()
  if (!text) return ''
  return text.includes('<') ? text : `<p>${text}</p>`
}

/** Runs `worker` over `items` with at most `limit` in flight, preserving result order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  })

  await Promise.all(runners)
  return results
}

function formatUserErrors(
  errors: { field?: string[] | null; message: string; code?: string | null }[]
): string {
  return errors
    .map((error) => {
      const field = error.field?.length ? `${error.field.join('.')}: ` : ''
      const code = error.code ? ` (${error.code})` : ''
      return `${field}${error.message}${code}`
    })
    .join('; ')
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

async function pickLocationId(request: AdminRequestFn): Promise<string> {
  const data = await request<LocationsResponse>(LOCATIONS_QUERY)
  const nodes = data.locations?.nodes ?? []
  if (nodes.length === 0) throw new Error('No Shopify locations found — set one up first.')
  const shipping = nodes.find((node) => node.shipsInventory)
  return (shipping ?? nodes[0]).id
}

async function loadPrismaCatalog(prisma: PrismaClient) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      variants: true,
      category: true,
      collections: { include: { collection: true }, orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const collections = await prisma.collection.findMany({
    where: { isActive: true },
    include: { products: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  })

  return { products, collections }
}

/** Upserts one product through the async `productSet` pipeline and returns its id-map entry. */
async function migrateProduct(
  product: MigrationProduct,
  input: ProductSetInput,
  request: AdminRequestFn
): Promise<ProductIdMapEntry> {
  const existing = await request<ProductByHandleResponse>(PRODUCT_BY_HANDLE_QUERY, {
    handle: product.slug,
  })
  const existingId = existing.productByIdentifier?.id ?? null

  const data = await request<ProductSetResponse>(PRODUCT_SET_MUTATION, {
    input: existingId ? { ...input, id: existingId } : input,
  })

  const errors = data.productSet?.userErrors ?? []
  if (errors.length > 0) {
    throw new Error(`productSet(${product.slug}) failed — ${formatUserErrors(errors)}`)
  }

  const operationId = data.productSet?.productSetOperation?.id
  if (!operationId) {
    throw new Error(`productSet(${product.slug}) returned no operation id`)
  }

  const result = await pollProductOperation(operationId, { request })

  // Variants are matched back to Prisma by SKU (the migration's stable variant key).
  const bySku = new Map(product.variants.map((variant) => [variant.sku, variant.id]))
  return {
    prismaProductId: product.id,
    shopifyProductId: result.productId,
    handle: result.handle,
    variants: result.variants.map((variant) => ({
      prismaVariantId: variant.sku ? (bySku.get(variant.sku) ?? null) : null,
      shopifyVariantId: variant.id,
      sku: variant.sku,
    })),
  }
}

async function findOrCreateCollection(
  request: AdminRequestFn,
  input: Record<string, unknown> & { handle: string }
): Promise<string> {
  const existing = await request<CollectionByHandleResponse>(COLLECTION_BY_HANDLE_QUERY, {
    handle: input.handle,
  })
  if (existing.collectionByIdentifier?.id) return existing.collectionByIdentifier.id

  const created = await request<CollectionCreateResponse>(COLLECTION_CREATE_MUTATION, { input })
  const errors = created.collectionCreate?.userErrors ?? []
  if (errors.length > 0 || !created.collectionCreate?.collection) {
    throw new Error(`collectionCreate(${input.handle}) failed — ${formatUserErrors(errors)}`)
  }
  return created.collectionCreate.collection.id
}

async function addProductsToCollection(
  request: AdminRequestFn,
  collectionId: string,
  productIds: string[]
): Promise<void> {
  if (productIds.length === 0) return
  const data = await request<CollectionAddProductsResponse>(COLLECTION_ADD_PRODUCTS_MUTATION, {
    id: collectionId,
    productIds,
  })
  const errors = data.collectionAddProductsV2?.userErrors ?? []
  if (errors.length > 0) {
    throw new Error(`collectionAddProductsV2 failed — ${formatUserErrors(errors)}`)
  }
}

async function resolvePublicationIds(request: AdminRequestFn): Promise<string[]> {
  const data = await request<PublicationsResponse>(PUBLICATIONS_QUERY)
  const nodes = data.publications?.nodes ?? []
  const nameOf = (node: { name: string; catalog: { title: string } | null }): string =>
    node.catalog?.title ?? node.name
  const matched = nodes.filter((node) =>
    PUBLICATION_NAMES.includes(nameOf(node) as (typeof PUBLICATION_NAMES)[number])
  )
  const missing = PUBLICATION_NAMES.filter((name) => !matched.some((node) => nameOf(node) === name))
  if (missing.length > 0) {
    console.warn(`⚠️  Publication(s) not found, skipping: ${missing.join(', ')}`)
  }
  return matched.map((node) => node.id)
}

async function publish(
  request: AdminRequestFn,
  id: string,
  publicationIds: string[]
): Promise<void> {
  if (publicationIds.length === 0) return
  const data = await request<PublishablePublishResponse>(PUBLISHABLE_PUBLISH_MUTATION, {
    id,
    input: publicationIds.map((publicationId) => ({ publicationId })),
  })
  const errors = data.publishablePublish?.userErrors ?? []
  if (errors.length > 0) {
    throw new Error(`publishablePublish(${id}) failed — ${formatUserErrors(errors)}`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const apply = isApply()
  const limit = Number(flagValue('limit') ?? '0')

  console.log('📦 Shopify catalog migration')
  console.log(`Mode: ${apply ? 'apply' : 'dry-run'}`)
  if (!apply) console.log('Tip: re-run with --apply to write to Shopify.')

  const prisma = new PrismaClient()

  try {
    let request: AdminRequestFn | null = null
    let storeDomain = 'dry-run'
    let locationId = PLACEHOLDER_LOCATION_ID

    if (apply) {
      const env = await loadAdminEnv()
      storeDomain = env.storeDomain
      const client = await loadAdminClient()
      request = client.adminRequest
      locationId = await pickLocationId(request)
      console.log(`Store: ${storeDomain}`)
      console.log(`Location: ${locationId}`)
    } else {
      // A dry run performs no Shopify calls at all, so the location is a placeholder.
      console.log(`Location: ${locationId} (placeholder — resolved from Shopify on --apply)`)
    }

    const { products, collections } = await loadPrismaCatalog(prisma)
    const selected = limit > 0 ? products.slice(0, limit) : products
    const inputs = selected.map((product) =>
      buildProductSetInput(product, { locationId })
    )

    console.log(
      `\nPrisma: ${selected.length} active products, ` +
        `${selected.reduce((total, product) => total + product.variants.length, 0)} variants, ` +
        `${collections.length} active collections`
    )

    if (!apply) {
      console.log('\nFirst 3 productSet inputs:')
      for (const input of inputs.slice(0, 3)) {
        console.log(JSON.stringify(input, null, 2))
      }
      console.log(
        `\nWould upsert ${inputs.length} products, ` +
          `${collections.length + 2} collections (+ drops, best-sellers), ` +
          `and publish to ${PUBLICATION_NAMES.join(' + ')}.`
      )
      console.log('Dry run complete — nothing was written to Shopify.')
      return
    }

    if (!request) throw new Error('Admin client unavailable')
    const adminRequest = request

    // 1. Products -------------------------------------------------------------
    const productEntries = await mapWithConcurrency(selected, CONCURRENCY, async (product, index) =>
      migrateProduct(product, inputs[index], adminRequest)
    )
    console.log(`✓ ${productEntries.length} products upserted`)

    const shopifyIdByPrismaId = new Map(
      productEntries.map((entry) => [entry.prismaProductId, entry.shopifyProductId])
    )

    // 2. Collections ----------------------------------------------------------
    const collectionEntries: CollectionIdMapEntry[] = []

    for (const collection of collections) {
      const collectionId = await findOrCreateCollection(adminRequest, {
        handle: collection.slug,
        title: collection.name,
        descriptionHtml: toDescriptionHtml(collection.description),
        ...(collection.image ? { image: { src: collection.image } } : {}),
        metafields: [
          {
            namespace: 'custom',
            key: 'featured',
            type: 'boolean',
            value: String(collection.isFeatured),
          },
        ],
      })

      const productIds = collection.products
        .map((link) => shopifyIdByPrismaId.get(link.productId))
        .filter((id): id is string => Boolean(id))

      await addProductsToCollection(adminRequest, collectionId, productIds)
      collectionEntries.push({
        prismaCollectionId: collection.id,
        shopifyCollectionId: collectionId,
        handle: collection.slug,
      })
      console.log(`✓ collection ${collection.slug} (${productIds.length} products)`)
    }

    // Smart collection of everything tagged `drop`.
    const dropsId = await findOrCreateCollection(adminRequest, {
      handle: 'drops',
      title: 'Drops',
      descriptionHtml: '<p>Limited-edition releases.</p>',
      ruleSet: {
        appliedDisjunctively: false,
        rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'drop' }],
      },
    })
    collectionEntries.push({
      prismaCollectionId: null,
      shopifyCollectionId: dropsId,
      handle: 'drops',
    })

    // Manual, intentionally empty for now — merchandised by hand later.
    const bestSellersId = await findOrCreateCollection(adminRequest, {
      handle: 'best-sellers',
      title: 'Best sellers',
      descriptionHtml: '<p>What everyone is wearing.</p>',
    })
    collectionEntries.push({
      prismaCollectionId: null,
      shopifyCollectionId: bestSellersId,
      handle: 'best-sellers',
    })
    console.log(`✓ ${collectionEntries.length} collections ready`)

    // 3. Publish --------------------------------------------------------------
    const publicationIds = await resolvePublicationIds(adminRequest)
    for (const entry of productEntries) {
      await publish(adminRequest, entry.shopifyProductId, publicationIds)
    }
    for (const entry of collectionEntries) {
      await publish(adminRequest, entry.shopifyCollectionId, publicationIds)
    }
    console.log(
      `✓ published ${productEntries.length + collectionEntries.length} resources to ` +
        `${publicationIds.length} publication(s)`
    )

    // 4. id-map ---------------------------------------------------------------
    const idMap: IdMap = {
      generatedAt: new Date().toISOString(),
      storeDomain,
      locationId,
      products: productEntries,
      collections: collectionEntries,
    }
    await mkdir(OUT_DIR, { recursive: true })
    await writeFile(ID_MAP_PATH, `${JSON.stringify(idMap, null, 2)}\n`, 'utf8')

    console.log(`\nid map → ${ID_MAP_PATH}`)
    console.log(
      `Summary: ${idMap.products.length} products, ` +
        `${idMap.products.reduce((total, entry) => total + entry.variants.length, 0)} variants, ` +
        `${idMap.collections.length} collections`
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error((error as Error).message)
  process.exitCode = 1
})
