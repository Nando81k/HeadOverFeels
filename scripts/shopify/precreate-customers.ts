/**
 * Pre-creates Prisma customers in Shopify and links the gid (Phase 4, Task 3).
 *
 *   npx tsx scripts/shopify/precreate-customers.ts                  # dry run (default): read-only lookups, NO writes
 *   npx tsx scripts/shopify/precreate-customers.ts --apply          # links / creates and writes Customer.shopifyCustomerId
 *   npx tsx scripts/shopify/precreate-customers.ts --apply --limit 5   # first N customers only (oldest first)
 *
 * Rows: `Customer` with `anonymizedAt` null and `shopifyCustomerId` null. Each one is looked up
 * with `customers(query: "email:<email>")`; a match writes the gid, otherwise `customerCreate`
 * ({ email, firstName, lastName, emailMarketingConsent from `newsletter` }) and the new gid is
 * written. Idempotent: linked rows drop out of the query, and a re-run never creates a customer
 * that already exists by email. THROTTLED answers back off and retry. The run prints a table and
 * writes `scripts/shopify/out/customer-map.json` (git-ignored).
 *
 * Dry run still queries Shopify (read-only) when `.env.shopify` is present so the table shows
 * would-link vs would-create; without credentials every row is reported as would-create.
 *
 * Admin API 2026-07 (documents validated 2026-10-11, see lib/precreate-customers.ts). Needs the
 * `read_customers write_customers` scopes on "HOF Ops", `.env.shopify` and DATABASE_URL. Tokens
 * are never printed. Human steps: docs/superpowers/plans/2026-09-06-storefront-rebuild-phase4-shopify-checklist.md
 */
import './lib/load-env'

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { PrismaClient } from '@prisma/client'

import { flagValue, isApply, loadAdminClient, loadAdminEnv } from './lib/load-env'
import {
  formatCustomerTable,
  precreateCustomers,
  summarizeEntries,
  type AdminRequestFn,
  type CustomerMapEntry,
  type PrecreateCustomerRow,
} from './lib/precreate-customers'

const OUT_DIR = path.join('scripts', 'shopify', 'out')
const MAP_PATH = path.join(OUT_DIR, 'customer-map.json')

interface CustomerMap {
  generatedAt: string
  mode: 'dry-run' | 'apply'
  storeDomain: string
  customers: CustomerMapEntry[]
}

async function loadRows(prisma: PrismaClient, limit: number): Promise<PrecreateCustomerRow[]> {
  return prisma.customer.findMany({
    where: { anonymizedAt: null, shopifyCustomerId: null },
    select: { id: true, email: true, name: true, newsletter: true },
    orderBy: { createdAt: 'asc' },
    ...(limit > 0 ? { take: limit } : {}),
  })
}

async function main(): Promise<void> {
  const apply = isApply()
  const limit = Number(flagValue('limit') ?? '0')

  console.log('👤 Shopify customer pre-creation')
  console.log(`Mode: ${apply ? 'apply' : 'dry-run'}`)
  if (!apply) console.log('Tip: re-run with --apply to create/link customers and write the gids.')

  let request: AdminRequestFn | null = null
  let storeDomain = 'dry-run'
  try {
    const env = await loadAdminEnv()
    storeDomain = env.storeDomain
    request = (await loadAdminClient()).adminRequest
    console.log(`Store: ${storeDomain}`)
  } catch (error) {
    if (apply) throw error
    console.log(`Store: unavailable (${(error as Error).message}) — lookups skipped`)
  }

  const prisma = new PrismaClient()
  try {
    const rows = await loadRows(prisma, limit)
    console.log(`\nPrisma: ${rows.length} customer(s) without a Shopify id${limit > 0 ? ` (limit ${limit})` : ''}`)
    if (rows.length === 0) {
      console.log('Nothing to do.')
      return
    }

    const entries = await precreateCustomers(rows, {
      request,
      apply,
      link: async (prismaCustomerId, shopifyCustomerId) => {
        await prisma.customer.update({
          where: { id: prismaCustomerId },
          data: { shopifyCustomerId },
        })
      },
      onEntry: (entry) => {
        const marker = entry.action === 'error' ? '✗' : '✓'
        console.log(`  ${marker} ${entry.action.padEnd(12)} ${entry.email}${entry.note ? ` — ${entry.note}` : ''}`)
      },
    })

    console.log(`\n${formatCustomerTable(entries)}`)

    const map: CustomerMap = {
      generatedAt: new Date().toISOString(),
      mode: apply ? 'apply' : 'dry-run',
      storeDomain,
      customers: entries,
    }
    await mkdir(OUT_DIR, { recursive: true })
    await writeFile(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`, 'utf8')

    const summary = summarizeEntries(entries)
    console.log(`\ncustomer map → ${MAP_PATH}`)
    console.log(
      `Summary: ${Object.entries(summary)
        .filter(([, count]) => count > 0)
        .map(([action, count]) => `${count} ${action}`)
        .join(', ')}`
    )
    if (!apply) console.log('Dry run complete — nothing was written to Shopify or Prisma.')
    if (summary.error > 0) process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error((error as Error).message)
  process.exitCode = 1
})
