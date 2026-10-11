/**
 * Registers the loyalty webhooks on the store (Phase 4, Task 3).
 *
 *   npx tsx scripts/shopify/register-webhooks.ts --base-url https://<host>            # dry run (default): lists existing + the plan
 *   npx tsx scripts/shopify/register-webhooks.ts --base-url https://<host> --apply    # creates the missing subscriptions
 *
 * `--base-url` falls back to NEXT_PUBLIC_BASE_URL. Topics ORDERS_PAID, ORDERS_CANCELLED,
 * REFUNDS_CREATE and CUSTOMERS_UPDATE are subscribed to `<base>/api/webhooks/shopify` (JSON).
 * Existing subscriptions are listed first; the script is idempotent by (topic, uri), so a second
 * `--apply` creates nothing. A same-topic subscription at another uri (an older preview host) is
 * reported but never deleted — remove it in Shopify admin → Settings → Notifications → Webhooks.
 *
 * Admin API 2026-07 (documents validated 2026-10-11, see lib/register-webhooks.ts). Needs
 * `.env.shopify` (SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN). The deliveries are signed
 * with the "HOF Ops" app's API secret key → SHOPIFY_WEBHOOK_SECRET on Vercel. Tokens are never
 * printed. Human steps: docs/superpowers/plans/2026-09-06-storefront-rebuild-phase4-shopify-checklist.md
 */
import './lib/load-env'

import { flagValue, isApply, loadAdminClient, loadAdminEnv } from './lib/load-env'
import { buildWebhookUri, registerWebhooks, type ExistingSubscription } from './lib/register-webhooks'

function printSubscriptions(label: string, items: ExistingSubscription[]): void {
  console.log(label)
  if (items.length === 0) {
    console.log('  (none)')
    return
  }
  for (const item of items) console.log(`  ${item.topic.padEnd(18)} ${item.uri}  (${item.id})`)
}

async function main(): Promise<void> {
  const apply = isApply()
  const baseUrl = flagValue('base-url') ?? process.env.NEXT_PUBLIC_BASE_URL ?? ''

  console.log('🔔 Shopify webhook registration')
  console.log(`Mode: ${apply ? 'apply' : 'dry-run'}`)
  if (!apply) console.log('Tip: re-run with --apply to create the missing subscriptions.')

  // Fails fast on http://, localhost or a path before any credential is read.
  const uri = buildWebhookUri(baseUrl)
  console.log(`Endpoint: ${uri}`)

  const env = await loadAdminEnv()
  console.log(`Store: ${env.storeDomain}\n`)
  const { adminRequest } = await loadAdminClient()

  const result = await registerWebhooks({ request: adminRequest, baseUrl, apply })

  printSubscriptions('Already registered (exact topic + uri match):', result.plan.existing)
  printSubscriptions('Same topic at another uri (left alone — delete by hand if stale):', result.plan.foreign)

  console.log(apply ? '\nCreated:' : '\nWould create:')
  if (result.plan.create.length === 0) console.log('  (nothing — all four topics are registered)')
  for (const item of result.plan.create) {
    const created = result.created.find((sub) => sub.topic === item.topic)
    const error = result.errors.find((err) => err.topic === item.topic)
    const suffix = created ? `  (${created.id})` : error ? `  ✗ ${error.message}` : ''
    console.log(`  ${item.topic.padEnd(18)} ${item.uri}${suffix}`)
  }

  if (!apply) {
    console.log('\nDry run complete — nothing was written to Shopify.')
    return
  }
  console.log(`\n✓ ${result.created.length} created, ${result.plan.existing.length} already present, ${result.errors.length} failed`)
  if (result.errors.length > 0) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error((error as Error).message)
  process.exitCode = 1
})
