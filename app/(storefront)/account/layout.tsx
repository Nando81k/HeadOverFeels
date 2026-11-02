import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AccountShell } from '@/components/storefront/account/AccountShell'
import { hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { getCustomerSession } from '@/lib/shopify/customer/session'

/**
 * `/account/*`: every page reads the session cookie, so nothing here is cached
 * and nothing here is indexed (Phase 4 plan, Task 5).
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
}

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const available = hasCustomerAccountEnv()
  // RSC-safe read: a stale session still counts as "signed in" for the chrome;
  // the page itself goes through `/account/refresh` when it needs a live token.
  const session = available ? await getCustomerSession() : null

  return (
    <AccountShell available={available} signedIn={session !== null}>
      {children}
    </AccountShell>
  )
}
