/**
 * Creates the storefront metafield definitions in Shopify (Phase 1, Task 3).
 *
 *   npx tsx scripts/shopify/setup-metafields.ts            # dry run (default): prints the table
 *   npx tsx scripts/shopify/setup-metafields.ts --apply    # creates the definitions
 *
 * Idempotent: a definition that already exists comes back as `userErrors.code === 'TAKEN'`,
 * which is reported as "exists" rather than an error, so the script can be re-run safely.
 *
 * GraphQL targets Admin API 2026-07 (`MetafieldDefinitionInput`). Validate the document against
 * the store's API version before the first `--apply` run. Requires `.env.shopify`
 * (SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN). Tokens are never printed.
 */
import './lib/load-env'

import { isApply, loadAdminClient, loadAdminEnv } from './lib/load-env'
import {
  METAFIELD_DEFINITIONS,
  toDefinitionInput,
  type MetafieldDefinitionRow,
} from './lib/metafield-definitions'

const METAFIELD_DEFINITION_CREATE = /* GraphQL */ `
  mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

interface MetafieldDefinitionCreateResponse {
  metafieldDefinitionCreate: {
    createdDefinition: { id: string } | null
    userErrors: { field?: string[] | null; message: string; code?: string | null }[]
  }
}

type Status = 'planned' | 'created' | 'exists' | 'error'

interface ResultRow {
  key: string
  owner: string
  type: string
  status: Status
  detail: string
}

function printTable(rows: ResultRow[]): void {
  const table = [
    ['KEY', 'OWNER', 'TYPE', 'STATUS', 'DETAIL'],
    ...rows.map((row) => [`custom.${row.key}`, row.owner, row.type, row.status, row.detail]),
  ]
  const widths = table[0].map((_, column) =>
    Math.max(...table.map((cells) => cells[column].length))
  )

  for (const cells of table) {
    console.log(
      cells
        .map((cell, column) => cell.padEnd(widths[column]))
        .join('  ')
        .trimEnd()
    )
  }
}

async function createDefinition(
  row: MetafieldDefinitionRow,
  adminRequest: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>
): Promise<ResultRow> {
  const base: Omit<ResultRow, 'status' | 'detail'> = {
    key: row.key,
    owner: row.ownerType,
    type: row.type,
  }

  try {
    const data = await adminRequest<MetafieldDefinitionCreateResponse>(
      METAFIELD_DEFINITION_CREATE,
      { definition: toDefinitionInput(row) }
    )
    const result = data.metafieldDefinitionCreate
    const errors = result?.userErrors ?? []

    if (errors.length === 0 && result?.createdDefinition) {
      return { ...base, status: 'created', detail: result.createdDefinition.id }
    }
    if (errors.every((error) => error.code === 'TAKEN')) {
      return { ...base, status: 'exists', detail: 'already defined' }
    }
    return {
      ...base,
      status: 'error',
      detail: errors.map((error) => `${error.code ?? 'ERROR'}: ${error.message}`).join('; '),
    }
  } catch (error) {
    return { ...base, status: 'error', detail: (error as Error).message }
  }
}

async function main(): Promise<void> {
  const apply = isApply()

  console.log('🏷️  Shopify metafield definitions')
  console.log(`Mode: ${apply ? 'apply' : 'dry-run'}`)
  if (!apply) {
    console.log('Tip: re-run with --apply to create the definitions in Shopify.\n')
    printTable(
      METAFIELD_DEFINITIONS.map((row) => ({
        key: row.key,
        owner: row.ownerType,
        type: row.type,
        status: 'planned' as const,
        detail: row.name,
      }))
    )
    console.log(`\n${METAFIELD_DEFINITIONS.length} definitions would be created.`)
    return
  }

  const env = await loadAdminEnv()
  console.log(`Store: ${env.storeDomain}\n`)

  const { adminRequest } = await loadAdminClient()

  const results: ResultRow[] = []
  for (const row of METAFIELD_DEFINITIONS) {
    results.push(await createDefinition(row, adminRequest))
  }

  printTable(results)

  const created = results.filter((row) => row.status === 'created').length
  const exists = results.filter((row) => row.status === 'exists').length
  const failed = results.filter((row) => row.status === 'error')
  console.log(`\ncreated: ${created}  exists: ${exists}  errors: ${failed.length}`)

  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error((error as Error).message)
  process.exitCode = 1
})
