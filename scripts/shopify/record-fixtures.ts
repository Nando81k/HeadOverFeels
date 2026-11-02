/**
 * Records Storefront API responses into tests/fixtures/shopify (Phase 1, Task 4 Step 7).
 *
 *   npx tsx scripts/shopify/record-fixtures.ts
 *   npx tsx scripts/shopify/record-fixtures.ts --only shop-layout
 *   npx tsx scripts/shopify/record-fixtures.ts --product tokyo-nights-hoodie --collection all
 *
 * Every entry of scripts/shopify/lib/fixture-queries.ts is executed against
 * `https://<domain>/api/<version>/graphql.json` with the PRIVATE Storefront token and its raw
 * response `data` is written to `tests/fixtures/shopify/<name>.json`. Nothing is stripped:
 * these files are the contract the normaliser tests assert against, so re-record whenever a
 * query changes. This script only reads from Shopify — it never mutates the store.
 *
 * Handles default to the first product/collection in `scripts/shopify/out/id-map.json`
 * (written by migrate-catalog.ts), else `all`. Tokens are never printed.
 */
import './lib/load-env'

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { flagValue } from './lib/load-env'
import { FIXTURE_QUERIES, type FixtureQueryContext } from './lib/fixture-queries'

const ID_MAP_PATH = path.join('scripts', 'shopify', 'out', 'id-map.json')
const FIXTURE_DIR = path.join('tests', 'fixtures', 'shopify')

interface IdMapFile {
  products?: { handle?: string }[]
  collections?: { handle?: string }[]
}

async function readIdMapHandles(): Promise<Partial<FixtureQueryContext>> {
  try {
    const raw = await readFile(ID_MAP_PATH, 'utf8')
    const parsed = JSON.parse(raw) as IdMapFile
    return {
      productHandle: parsed.products?.[0]?.handle,
      collectionHandle: parsed.collections?.[0]?.handle,
    }
  } catch {
    return {}
  }
}

function resolveVariables(
  entry: (typeof FIXTURE_QUERIES)[string],
  context: FixtureQueryContext
): Record<string, unknown> | undefined {
  if (typeof entry.variables === 'function') return entry.variables(context)
  return entry.variables
}

async function main(): Promise<void> {
  const { getShopifyEnv } = await import('../../lib/shopify/env')
  const env = getShopifyEnv()
  const endpoint = `https://${env.storeDomain}/api/${env.apiVersion}/graphql.json`

  const fromIdMap = await readIdMapHandles()
  const context: FixtureQueryContext = {
    productHandle: flagValue('product') ?? fromIdMap.productHandle ?? 'all',
    collectionHandle: flagValue('collection') ?? fromIdMap.collectionHandle ?? 'all',
  }

  const only = flagValue('only')
  const names = only ? [only] : Object.keys(FIXTURE_QUERIES)
  const unknown = names.filter((name) => !(name in FIXTURE_QUERIES))
  if (unknown.length > 0) {
    throw new Error(
      `Unknown fixture(s): ${unknown.join(', ')}. Known: ${Object.keys(FIXTURE_QUERIES).join(', ')}`
    )
  }

  console.log('🎬 Recording Storefront fixtures')
  console.log(`Endpoint: ${endpoint}`)
  console.log(`Product handle: ${context.productHandle}  Collection handle: ${context.collectionHandle}`)
  console.log(`Fixtures: ${names.join(', ')}\n`)

  await mkdir(FIXTURE_DIR, { recursive: true })

  let failures = 0
  for (const name of names) {
    const entry = FIXTURE_QUERIES[name]
    const variables = resolveVariables(entry, context)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Shopify-Storefront-Private-Token': env.privateToken,
      },
      body: JSON.stringify({ query: entry.query, variables }),
    })

    if (!response.ok) {
      failures += 1
      console.error(`✗ ${name}: HTTP ${response.status} ${response.statusText}`)
      continue
    }

    const body = (await response.json()) as {
      data?: unknown
      errors?: { message: string }[]
    }

    if (body.errors?.length) {
      failures += 1
      console.error(`✗ ${name}: ${body.errors.map((error) => error.message).join('; ')}`)
      continue
    }

    const file = path.join(FIXTURE_DIR, `${name}.json`)
    await writeFile(file, `${JSON.stringify(body.data, null, 2)}\n`, 'utf8')
    console.log(`✓ ${name} → ${file}`)
  }

  console.log(`\nrecorded: ${names.length - failures}  failed: ${failures}`)
  if (failures > 0) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error((error as Error).message)
  process.exitCode = 1
})
