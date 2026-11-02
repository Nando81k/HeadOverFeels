'use client'

import * as React from 'react'
import Link from 'next/link'
import { loadMoreOrdersAction } from '@/app/(storefront)/_actions/account'
import { OrderCard } from '@/components/storefront/account/OrderCard'
import { Button } from '@/components/storefront/ui/Button'
import type { AccountActionResult, CustomerOrderCard, CustomerOrdersPage } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

/**
 * The Shopify orders list with cursor paging (Phase 4 plan, Task 5; mockup
 * 03). The page renders the first page on the server; "Load more" appends the
 * next one through `loadMoreOrdersAction` (injectable for tests).
 */

export type LoadMoreOrders = (after: string) => Promise<AccountActionResult<CustomerOrdersPage>>

export interface OrderListProps {
  initialPage: CustomerOrdersPage
  /** Defaults to the Server Action. */
  loadMore?: LoadMoreOrders
  className?: string
}

const NETWORK_ERROR = 'Something went wrong loading more orders.'

export function OrderList({ initialPage, loadMore = loadMoreOrdersAction, className }: OrderListProps) {
  const [orders, setOrders] = React.useState<CustomerOrderCard[]>(initialPage.orders)
  const [cursor, setCursor] = React.useState<string | null>(
    initialPage.hasNextPage ? initialPage.endCursor : null
  )
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  const onLoadMore = () => {
    if (!cursor) return
    const after = cursor
    setError(null)
    startTransition(async () => {
      let result: AccountActionResult<CustomerOrdersPage>
      try {
        result = await loadMore(after)
      } catch {
        result = { ok: false, error: NETWORK_ERROR }
      }
      if (!result.ok) {
        setError(result.error)
        return
      }
      const seen = new Set(orders.map((order) => order.id))
      setOrders((current) => [...current, ...result.data.orders.filter((order) => !seen.has(order.id))])
      setCursor(result.data.hasNextPage ? result.data.endCursor : null)
    })
  }

  if (orders.length === 0) {
    return (
      <div data-orders-empty="" className={cn('flex flex-col items-start gap-4 py-6', className)}>
        <p className="text-sm text-ink-soft">No orders yet — your first one earns Care Points.</p>
        <Button asChild variant="outline">
          <Link href="/collections/all">Shop the collection</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="border-t border-line">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-4 border border-danger bg-paper px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {cursor ? (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={onLoadMore} loading={pending}>
            Load more orders
          </Button>
        </div>
      ) : null}
    </div>
  )
}
