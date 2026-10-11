import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { renderAccountPage } from '@/components/storefront/account/AccountShell'
import { orderGidFromId } from '@/components/storefront/account/OrderCard'
import { OrderDetail } from '@/components/storefront/account/OrderDetail'
import { prisma } from '@/lib/prisma'
import { getCustomerOrder } from '@/lib/shopify/customer/queries'

/**
 * `/account/orders/[id]` (Phase 4 plan, Task 5; mockup 04). `id` is the
 * numeric tail of the order gid; the Customer Account API only returns the
 * order when it belongs to the token's customer, so a foreign id is a 404.
 *
 * The Care Points line is the ledger row the `orders/paid` webhook stamped
 * with this order's gid (`PointsTransaction.metadata`, a JSON string column —
 * hence `contains`). No row → no line.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Order',
  robots: { index: false, follow: false },
}

async function pointsEarnedFor(orderGid: string): Promise<number | null> {
  try {
    const row = await prisma.pointsTransaction.findFirst({
      where: { metadata: { contains: orderGid }, points: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
      select: { points: true },
    })
    return row ? row.points : null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[storefront] order points lookup failed: ${message}`)
    return null
  }
}

export default async function OrderDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orderGid = orderGidFromId(id)
  if (!orderGid) notFound()

  return renderAccountPage(`/account/orders/${id}`, async (session) => {
    const order = await getCustomerOrder(session.tokens.accessToken, orderGid)
    if (!order) notFound()
    const pointsEarned = await pointsEarnedFor(orderGid)
    return <OrderDetail order={order} pointsEarned={pointsEarned} />
  })
}
