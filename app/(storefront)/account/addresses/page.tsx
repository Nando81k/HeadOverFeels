import type { Metadata } from 'next'
import { renderAccountPage } from '@/components/storefront/account/AccountShell'
import { AddressBook } from '@/components/storefront/account/AddressCard'
import { getCustomerAddresses } from '@/lib/shopify/customer/queries'

/** `/account/addresses` (Phase 4 plan, Task 5; mockup 05): cards + add/edit forms. */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Addresses',
  robots: { index: false, follow: false },
}

const PATH = '/account/addresses'

export default async function AddressesRoute() {
  return renderAccountPage(PATH, async (session) => {
    const addresses = await getCustomerAddresses(session.tokens.accessToken)
    return <AddressBook initial={addresses} />
  })
}
