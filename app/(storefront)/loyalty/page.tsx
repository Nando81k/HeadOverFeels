import type { Metadata } from 'next'
import { getLoyaltyOverviewAction, loadLedgerAction } from '@/app/(storefront)/_actions/loyalty'
import { LoyaltyHub } from '@/components/storefront/loyalty/LoyaltyHub'
import type { LedgerPage } from '@/lib/loyalty/ledger'
import type { LoyaltyOverview } from '@/lib/loyalty/shopify-bridge'
import { hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { getCustomerSession } from '@/lib/shopify/customer/session'
import {
  EMPTY_LOYALTY_PUBLIC_DATA,
  getLoyaltyPublicData,
  type LoyaltyPublicData,
} from '@/lib/storefront/loyalty-public'

/**
 * The Care Points hub (Phase 4, Task 6). Public for everyone — tiers, how to
 * earn and the catalogue come from the 5-minute `loyalty-public` cache — while
 * the balance, history and referral read the session cookie, so the route is
 * dynamic. Signed-out and unconfigured visitors get HTTP 200 with inline
 * gates (plan, notes 5 and 6); nothing here redirects.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Care Points',
  description:
    'Earn Care Points on every order, climb the tiers and spend points on discounts, free shipping and early drop access.',
}

/** How many ledger rows the first paint carries; "Load more" pages from there. */
const FIRST_LEDGER_PAGE = 10

async function readPublicData(): Promise<LoyaltyPublicData> {
  try {
    return await getLoyaltyPublicData()
  } catch (error) {
    // A missing database (preview, e2e) must not take the public page down.
    console.error(
      `[storefront] loyalty public data failed: ${error instanceof Error ? error.message : String(error)}`
    )
    return EMPTY_LOYALTY_PUBLIC_DATA
  }
}

export default async function LoyaltyRoute() {
  const available = hasCustomerAccountEnv()
  const [publicData, session] = await Promise.all([
    readPublicData(),
    available ? getCustomerSession() : Promise.resolve(null),
  ])

  let initialOverview: LoyaltyOverview | null = null
  let initialLedger: LedgerPage | null = null
  let overviewError: string | null = null

  if (session) {
    const [overview, ledger] = await Promise.all([
      getLoyaltyOverviewAction(),
      loadLedgerAction({ filter: 'all', limit: FIRST_LEDGER_PAGE }),
    ])
    if (overview.ok) initialOverview = overview.data
    else overviewError = overview.error
    if (ledger.ok) initialLedger = ledger.data
  }

  return (
    <LoyaltyHub
      publicData={publicData}
      available={available}
      signedIn={session !== null}
      initialOverview={initialOverview}
      initialLedger={initialLedger}
      overviewError={overviewError}
    />
  )
}
