import type { Metadata } from 'next'
import { renderAccountPage } from '@/components/storefront/account/AccountShell'
import { EarlierOrdersList, loadEarlierOrders } from '@/components/storefront/account/EarlierOrders'
import { OrderList } from '@/components/storefront/account/OrderList'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { getCustomerOrders } from '@/lib/shopify/customer/queries'

/**
 * `/account/orders` (Phase 4 plan, Task 5; mockup 03): the Shopify orders
 * with cursor paging, then the read-only legacy orders matched by email.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Orders',
  robots: { index: false, follow: false },
}

const PATH = '/account/orders'
const PAGE_SIZE = 10

export default async function OrdersRoute() {
  return renderAccountPage(PATH, async (session) => {
    const [page, earlier] = await Promise.all([
      getCustomerOrders(session.tokens.accessToken, { first: PAGE_SIZE }),
      loadEarlierOrders(session.email),
    ])

    return (
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-2">
          <Eyebrow>Account</Eyebrow>
          <Display as="h1" size="md">
            Orders
          </Display>
        </header>

        <OrderList initialPage={page} />

        <EarlierOrdersList orders={earlier} id="earlier" variant="full" />
      </div>
    )
  })
}
