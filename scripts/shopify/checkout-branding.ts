/**
 * Applies the storefront look to the Shopify-hosted checkout (Phase 3, Task 3).
 *
 *   npx tsx scripts/shopify/checkout-branding.ts            # dry run (default)
 *   npx tsx scripts/shopify/checkout-branding.ts --apply    # upserts the branding
 *
 * Dry run: lists the checkout profiles when `.env.shopify` is present and the store is
 * reachable (read-only query), then prints the `CheckoutBrandingInput` JSON. `--apply` picks
 * the published profile and runs `checkoutBrandingUpsert`. Both modes end with the human
 * checklist from docs/superpowers/plans/2026-09-06-storefront-rebuild-phase3-shopify-checklist.md.
 *
 * GraphQL targets Admin API 2026-07 (validated 2026-10-10). Needs the
 * `read_checkout_branding_settings write_checkout_branding_settings` scopes and a Plus or
 * development store plan. Requires `.env.shopify` (SHOPIFY_STORE_DOMAIN,
 * SHOPIFY_ADMIN_ACCESS_TOKEN). Tokens are never printed.
 */
import './lib/load-env'

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  CHECKOUT_BRANDING_INPUT,
  CHECKOUT_BRANDING_UPSERT_MUTATION,
  CHECKOUT_PROFILES_QUERY,
  toBrandingVariables,
  type CheckoutBrandingUpsertResponse,
  type CheckoutProfilesResponse,
} from './lib/checkout-branding-input'
import { isApply, loadAdminClient, loadAdminEnv, type AdminClientModule } from './lib/load-env'

const CHECKLIST_PATH =
  'docs/superpowers/plans/2026-09-06-storefront-rebuild-phase3-shopify-checklist.md'

type Profile = CheckoutProfilesResponse['checkoutProfiles']['nodes'][number]

async function fetchProfiles(adminRequest: AdminClientModule['adminRequest']): Promise<Profile[]> {
  const data = await adminRequest<CheckoutProfilesResponse>(CHECKOUT_PROFILES_QUERY)
  return data.checkoutProfiles?.nodes ?? []
}

function printProfiles(profiles: Profile[]): void {
  if (profiles.length === 0) {
    console.log('No checkout profiles returned.')
    return
  }
  for (const profile of profiles) {
    console.log(`  ${profile.isPublished ? '*' : ' '} ${profile.name}  (${profile.id})`)
  }
  console.log('  (* = published)')
}

/** Prints the checklist's headings and checkbox lines, so the run ends with the human steps. */
function printChecklist(): void {
  const file = resolve(process.cwd(), CHECKLIST_PATH)
  console.log('\n— Human checklist —')
  if (!existsSync(file)) {
    console.log(`See ${CHECKLIST_PATH} (run from the repo root to print it here).`)
    return
  }
  const lines = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('#') || line.startsWith('- [ ]'))
  console.log(lines.join('\n'))
  console.log(`\nFull text: ${CHECKLIST_PATH}`)
}

async function dryRun(): Promise<void> {
  console.log('Tip: re-run with --apply to upsert the branding on the published profile.\n')

  try {
    const env = await loadAdminEnv()
    console.log(`Store: ${env.storeDomain}`)
    const { adminRequest } = await loadAdminClient()
    console.log('Checkout profiles:')
    printProfiles(await fetchProfiles(adminRequest))
  } catch (error) {
    console.log(`Checkout profiles: unavailable (${(error as Error).message})`)
  }

  console.log('\nCheckoutBrandingInput:')
  console.log(JSON.stringify(CHECKOUT_BRANDING_INPUT, null, 2))
}

async function apply(): Promise<boolean> {
  const env = await loadAdminEnv()
  console.log(`Store: ${env.storeDomain}\n`)

  const { adminRequest } = await loadAdminClient()
  const profiles = await fetchProfiles(adminRequest)
  console.log('Checkout profiles:')
  printProfiles(profiles)

  const published = profiles.find((profile) => profile.isPublished)
  if (!published) {
    console.error('\nNo published checkout profile found; nothing applied.')
    return false
  }

  const data = await adminRequest<CheckoutBrandingUpsertResponse>(
    CHECKOUT_BRANDING_UPSERT_MUTATION,
    toBrandingVariables(published.id) as unknown as Record<string, unknown>
  )
  const errors = data.checkoutBrandingUpsert?.userErrors ?? []
  if (errors.length > 0) {
    console.error('\nuserErrors:')
    for (const error of errors) {
      const field = error.field?.length ? `${error.field.join('.')}: ` : ''
      console.error(`  ${error.code ?? 'ERROR'} ${field}${error.message}`)
    }
    return false
  }

  console.log(`\napplied to ${published.name}`)
  return true
}

async function main(): Promise<void> {
  const applyMode = isApply()

  console.log('🎨 Shopify checkout branding')
  console.log(`Mode: ${applyMode ? 'apply' : 'dry-run'}`)

  let ok = true
  if (applyMode) {
    try {
      ok = await apply()
    } catch (error) {
      console.error((error as Error).message)
      ok = false
    }
  } else {
    await dryRun()
  }

  printChecklist()
  if (!ok) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error((error as Error).message)
  process.exitCode = 1
})
