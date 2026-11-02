// tests/unit/storefront/account-orders.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('server-only', () => ({}))
vi.mock('next/image', async () => {
  const react = await import('react')
  const nextOnly = new Set(['fill', 'priority', 'quality', 'loader', 'placeholder', 'blurDataURL', 'unoptimized', 'sizes'])
  return {
    default: (props: Record<string, unknown>) => {
      const attrs: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(props)) if (!nextOnly.has(key)) attrs[key] = value
      return react.createElement('img', attrs)
    },
  }
})

const { env, session, queries, prisma, nav, accountActions } = vi.hoisted(() => ({
  env: { hasCustomerAccountEnv: vi.fn(() => true) },
  session: { requireFreshSession: vi.fn(), getCustomerSession: vi.fn() },
  queries: { getCustomerOrders: vi.fn(), getCustomerOrder: vi.fn() },
  prisma: {
    order: { findMany: vi.fn() },
    pointsTransaction: { findFirst: vi.fn() },
  },
  nav: { redirect: vi.fn(), notFound: vi.fn() },
  accountActions: { loadMoreOrdersAction: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/account/orders',
  redirect: (...args: unknown[]) => {
    nav.redirect(...args)
    throw new Error(`NEXT_REDIRECT ${String(args[0])}`)
  },
  notFound: () => {
    nav.notFound()
    throw new Error('NEXT_NOT_FOUND')
  },
}))
vi.mock('@/lib/shopify/customer/env', () => env)
vi.mock('@/lib/shopify/customer/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shopify/customer/session')>()
  return { ...actual, ...session }
})
vi.mock('@/lib/shopify/customer/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shopify/customer/queries')>()
  return { ...actual, ...queries }
})
vi.mock('@/lib/prisma', () => ({ prisma }))
vi.mock('@/app/(storefront)/_actions/account', () => accountActions)

import OrderDetailRoute, {
  dynamic as detailDynamic,
  metadata as detailMetadata,
} from '@/app/(storefront)/account/orders/[id]/page'
import OrdersRoute, {
  dynamic as ordersDynamic,
  metadata as ordersMetadata,
} from '@/app/(storefront)/account/orders/page'
import {
  EarlierOrders,
  EarlierOrdersList,
  loadEarlierOrders,
  type EarlierOrder,
} from '@/components/storefront/account/EarlierOrders'
import { FulfillmentTimeline, timelineSteps } from '@/components/storefront/account/FulfillmentTimeline'
import {
  FULFILLMENT_LABEL,
  formatOrderDate,
  OrderCard,
  orderGidFromId,
  orderIdFromGid,
  orderPath,
} from '@/components/storefront/account/OrderCard'
import { OrderDetail } from '@/components/storefront/account/OrderDetail'
import { OrderList } from '@/components/storefront/account/OrderList'
import {
  normalizeOrder,
  normalizeOrdersPage,
  type RawOrderResponse,
  type RawOrdersResponse,
} from '@/lib/shopify/customer/queries'
import type { CustomerSession } from '@/lib/shopify/customer/session'
import type { AccountActionResult, CustomerOrder, CustomerOrdersPage } from '@/lib/shopify/types'
import orderFixture from '@/tests/fixtures/shopify/customer/order.json'
import ordersFixture from '@/tests/fixtures/shopify/customer/orders.json'

const PAGE: CustomerOrdersPage = normalizeOrdersPage(ordersFixture as unknown as RawOrdersResponse)
const ORDER: CustomerOrder = normalizeOrder((orderFixture as unknown as RawOrderResponse).order as NonNullable<RawOrderResponse['order']>)
const [FIRST, SECOND] = PAGE.orders

const SESSION: CustomerSession = {
  tokens: { accessToken: 'token-1', refreshToken: 'rt', idToken: 'id', expiresAt: Date.now() + 3_600_000 },
  customerId: 'gid://shopify/Customer/8123456789',
  email: 'Nando@Example.com',
  firstName: 'Nando',
  lastName: 'Alvarez',
}

const LEGACY: EarlierOrder[] = [
  {
    id: 'ord_2',
    orderNumber: 'HOF-2041',
    createdAt: '2025-03-02T10:00:00.000Z',
    status: 'DELIVERED',
    total: 64.5,
    items: [
      { id: 'it_1', productName: 'Signature Tee', quantity: 2, productImage: null, variantDetails: 'Black / L' },
    ],
  },
  {
    id: 'ord_1',
    orderNumber: 'HOF-1987',
    createdAt: '2024-11-20T10:00:00.000Z',
    status: 'REFUNDED',
    total: 120,
    items: [{ id: 'it_2', productName: 'Core Hoodie', quantity: 1, productImage: null, variantDetails: null }],
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  env.hasCustomerAccountEnv.mockReturnValue(true)
  session.requireFreshSession.mockResolvedValue(SESSION)
  prisma.order.findMany.mockResolvedValue([])
  prisma.pointsTransaction.findFirst.mockResolvedValue(null)
})

afterEach(() => {
  cleanup()
})

describe('order helpers', () => {
  it('derives the route id from the gid and back', () => {
    expect(orderIdFromGid('gid://shopify/Order/6123456789')).toBe('6123456789')
    expect(orderIdFromGid('gid://shopify/Order/6123456789?key=abc')).toBe('6123456789')
    expect(orderIdFromGid('nonsense')).toBeNull()
    expect(orderGidFromId('6123456789')).toBe('gid://shopify/Order/6123456789')
    expect(orderGidFromId('abc')).toBeNull()
    expect(orderGidFromId('')).toBeNull()
    expect(orderPath(FIRST)).toBe('/account/orders/6123456789')
  })

  it('formats dates in UTC so server and client agree', () => {
    expect(formatOrderDate('2026-10-06T15:42:10Z')).toBe('Oct 6, 2026')
    expect(formatOrderDate('2026-10-06T23:59:59Z')).toBe('Oct 6, 2026')
    expect(formatOrderDate('not a date')).toBe('')
  })
})

describe('OrderCard', () => {
  it('renders number, thumbnails, items, status, date, total and a View link', () => {
    render(<OrderCard order={FIRST} />)
    const card = screen.getByRole('article', { name: 'Order #1012' })
    expect(card.querySelector('.num')).toHaveTextContent('#1012')
    expect(within(card).getByText('Oct 6, 2026')).toBeInTheDocument()
    expect(within(card).getByText('2 items')).toBeInTheDocument()
    expect(within(card).getByText('Core Hoodie')).toBeInTheDocument()
    expect(within(card).getByText(FULFILLMENT_LABEL.FULFILLED)).toBeInTheDocument()
    expect(within(card).getByText('$162.88')).toHaveClass('num')
    expect(within(card).getByRole('link', { name: 'View order #1012' })).toHaveAttribute(
      'href',
      '/account/orders/6123456789'
    )
    const images = card.querySelectorAll('img')
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('alt', '')
  })

  it('singularises a one-item order', () => {
    render(<OrderCard order={SECOND} />)
    expect(screen.getByText('1 item')).toBeInTheDocument()
  })
})

describe('OrderList', () => {
  it('renders every order and no load-more when the page is complete', () => {
    render(<OrderList initialPage={PAGE} />)
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull()
  })

  it('renders an empty state with a way to shop', () => {
    render(<OrderList initialPage={{ orders: [], hasNextPage: false, endCursor: null }} />)
    expect(screen.getByText(/no orders yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /shop/i })).toHaveAttribute('href', '/collections/all')
  })

  it('appends the next page from the load-more action and stops at the end', async () => {
    const user = userEvent.setup()
    const loadMore = vi.fn<(after: string) => Promise<AccountActionResult<CustomerOrdersPage>>>(
      async () => ({ ok: true, data: { orders: [{ ...SECOND, id: 'gid://shopify/Order/1', name: '#1001', number: 1001 }], hasNextPage: false, endCursor: null } })
    )
    render(
      <OrderList initialPage={{ orders: [FIRST], hasNextPage: true, endCursor: 'cursor-1' }} loadMore={loadMore} />
    )
    await user.click(screen.getByRole('button', { name: /load more/i }))
    expect(loadMore).toHaveBeenCalledWith('cursor-1')
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull()
  })

  it('shows the action error inline and keeps the button', async () => {
    const user = userEvent.setup()
    const loadMore = vi.fn(async () => ({ ok: false as const, error: 'Please sign in again.', code: 'UNAUTHENTICATED' }))
    render(
      <OrderList initialPage={{ orders: [FIRST], hasNextPage: true, endCursor: 'cursor-1' }} loadMore={loadMore} />
    )
    await user.click(screen.getByRole('button', { name: /load more/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please sign in again.')
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
  })

  it('falls back to the Server Action when no loader is given', async () => {
    const user = userEvent.setup()
    accountActions.loadMoreOrdersAction.mockResolvedValue({ ok: true, data: { orders: [], hasNextPage: false, endCursor: null } })
    render(<OrderList initialPage={{ orders: [FIRST], hasNextPage: true, endCursor: 'cursor-9' }} />)
    await user.click(screen.getByRole('button', { name: /load more/i }))
    expect(accountActions.loadMoreOrdersAction).toHaveBeenCalledWith('cursor-9')
  })
})

describe('FulfillmentTimeline', () => {
  it('marks placed and shipped done with tracking, delivery pending', () => {
    const steps = timelineSteps(ORDER)
    expect(steps.map((step) => [step.key, step.state])).toEqual([
      ['placed', 'done'],
      ['shipped', 'done'],
      ['delivered', 'current'],
    ])
    render(<FulfillmentTimeline order={ORDER} />)
    const list = screen.getByRole('list', { name: 'Shipment progress' })
    expect(list.querySelectorAll('[data-step-state="done"]')).toHaveLength(2)
    expect(screen.getByRole('link', { name: /1Z999AA10123456784/ })).toHaveAttribute(
      'href',
      'https://www.ups.com/track?loc=en_US&tracknum=1Z999AA10123456784'
    )
    expect(screen.getByText(/UPS/)).toBeInTheDocument()
  })

  it('shows shipping as current when nothing has shipped', () => {
    const steps = timelineSteps({ ...ORDER, fulfillments: [], fulfillmentStatus: 'UNFULFILLED' })
    expect(steps.map((step) => step.state)).toEqual(['done', 'current', 'pending'])
  })

  it('collapses to a cancelled step when the order was cancelled', () => {
    const steps = timelineSteps({ ...ORDER, cancelledAt: '2026-10-07T00:00:00Z', fulfillments: [] })
    expect(steps.map((step) => step.key)).toEqual(['placed', 'cancelled'])
    expect(steps[1].state).toBe('current')
  })
})

describe('OrderDetail', () => {
  it('renders breadcrumb, items, summary with discount and points, and the address', () => {
    render(<OrderDetail order={ORDER} pointsEarned={150} />)
    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }))
    expect(crumbs.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
    expect(crumbs.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/account/orders')
    expect(crumbs.getByText('#1012')).toBeInTheDocument()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Order #1012')
    expect(screen.getByRole('link', { name: /order status page/i })).toHaveAttribute('href', ORDER.statusPageUrl)
    expect(screen.getByRole('link', { name: /order status page/i })).toHaveAttribute('rel', expect.stringContaining('noopener'))

    const items = within(screen.getByRole('list', { name: 'Items' }))
    expect(items.getByText('Core Hoodie')).toBeInTheDocument()
    expect(items.getByText('Taupe / M')).toBeInTheDocument()
    expect(items.getByText(/2 × \$88\.00/)).toBeInTheDocument()
    expect(items.getByText('$176.00')).toBeInTheDocument()

    const summary = screen.getByRole('region', { name: 'Summary' })
    expect(within(summary).getByText('Subtotal').nextElementSibling).toHaveTextContent('$149.60')
    expect(within(summary).getByText('Discount').nextElementSibling).toHaveTextContent('−15%')
    expect(within(summary).getByText('Shipping').nextElementSibling).toHaveTextContent('Free')
    expect(within(summary).getByText('Tax').nextElementSibling).toHaveTextContent('$13.28')
    expect(within(summary).getByText('Total').nextElementSibling).toHaveTextContent('$162.88')
    const points = summary.querySelector('[data-points-earned]')
    expect(points).toHaveTextContent('Earned 150 Care Points')
    expect(points?.querySelector('.num')).toHaveTextContent('150')

    const address = screen.getByRole('region', { name: 'Shipping address' })
    expect(address).toHaveTextContent('221 Bowery')
    expect(address).toHaveTextContent('New York NY 10012')
  })

  it('omits the points line and the status link when absent', () => {
    render(
      <OrderDetail
        order={{ ...ORDER, statusPageUrl: null, discounts: [{ amount: { amount: '10.0', currencyCode: 'USD' }, percentage: null }], shipping: { amount: '8.0', currencyCode: 'USD' } }}
        pointsEarned={null}
      />
    )
    expect(document.querySelector('[data-points-earned]')).toBeNull()
    expect(screen.queryByRole('link', { name: /order status page/i })).toBeNull()
    const summary = screen.getByRole('region', { name: 'Summary' })
    expect(within(summary).getByText('Discount').nextElementSibling).toHaveTextContent('−$10.00')
    expect(within(summary).getByText('Shipping').nextElementSibling).toHaveTextContent('$8.00')
  })
})

describe('EarlierOrders', () => {
  it('reads legacy orders by email, case-insensitively, newest first with items', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'ord_2',
        orderNumber: 'HOF-2041',
        createdAt: new Date('2025-03-02T10:00:00.000Z'),
        status: 'DELIVERED',
        total: 64.5,
        items: [{ id: 'it_1', productName: 'Signature Tee', quantity: 2, productImage: null, variantDetails: 'Black / L' }],
      },
    ])
    const orders = await loadEarlierOrders('Nando@Example.com', 5)
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerEmail: { equals: 'Nando@Example.com', mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
    )
    expect(orders).toEqual([expect.objectContaining({ orderNumber: 'HOF-2041', createdAt: '2025-03-02T10:00:00.000Z' })])
  })

  it('returns nothing when the database is unreachable', async () => {
    prisma.order.findMany.mockRejectedValue(new Error('no db'))
    await expect(loadEarlierOrders('nando@example.com', 5)).resolves.toEqual([])
  })

  it('renders read-only rows with number, date, status, items and total', () => {
    render(<EarlierOrdersList orders={LEGACY} />)
    const region = screen.getByRole('region', { name: 'Earlier orders' })
    const rows = within(region).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('HOF-2041')
    expect(rows[0]).toHaveTextContent('Mar 2, 2025')
    expect(rows[0]).toHaveTextContent('Delivered')
    expect(rows[0]).toHaveTextContent('Signature Tee × 2')
    expect(rows[0].querySelector('[data-order-total]')).toHaveTextContent('$64.50')
    expect(rows[0].querySelector('[data-order-total]')).toHaveClass('num')
    expect(within(region).queryByRole('link')).toBeNull()
    expect(region).toHaveTextContent(/before/i)
  })

  it('renders nothing without legacy orders', async () => {
    const { container } = render(<>{await EarlierOrders({ email: 'nando@example.com' })}</>)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the rows from the database when there are some', async () => {
    prisma.order.findMany.mockResolvedValue([
      { id: 'ord_1', orderNumber: 'HOF-1987', createdAt: new Date('2024-11-20T10:00:00.000Z'), status: 'SHIPPED', total: 120, items: [] },
    ])
    render(<>{await EarlierOrders({ email: 'nando@example.com', limit: 3 })}</>)
    expect(screen.getByRole('region', { name: 'Earlier orders' })).toHaveTextContent('HOF-1987')
    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }))
  })
})

describe('app/(storefront)/account/orders', () => {
  it('is dynamic and noindex', () => {
    expect(ordersDynamic).toBe('force-dynamic')
    expect(ordersMetadata.robots).toMatchObject({ index: false })
    expect(detailDynamic).toBe('force-dynamic')
    expect(detailMetadata.robots).toMatchObject({ index: false })
  })

  it('lists the Shopify orders with the fresh token and the earlier orders by email', async () => {
    queries.getCustomerOrders.mockResolvedValue(PAGE)
    prisma.order.findMany.mockResolvedValue([
      { id: 'ord_1', orderNumber: 'HOF-1987', createdAt: new Date('2024-11-20T10:00:00.000Z'), status: 'SHIPPED', total: 120, items: [] },
    ])
    render(await OrdersRoute())

    expect(session.requireFreshSession).toHaveBeenCalledWith('/account/orders')
    expect(queries.getCustomerOrders).toHaveBeenCalledWith('token-1', { first: 10 })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Orders')
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerEmail: { equals: 'Nando@Example.com', mode: 'insensitive' } } })
    )
    expect(screen.getByRole('region', { name: 'Earlier orders' })).toHaveAttribute('id', 'earlier')
  })

  it('renders the gate when signed out', async () => {
    const { SignedOutError } = await import('@/lib/shopify/customer/errors')
    session.requireFreshSession.mockRejectedValue(new SignedOutError())
    render(await OrdersRoute())
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/account/login?return_to=%2Faccount%2Forders')
    expect(queries.getCustomerOrders).not.toHaveBeenCalled()
  })

  it('renders the order detail with the points line from the ledger', async () => {
    queries.getCustomerOrder.mockResolvedValue(ORDER)
    prisma.pointsTransaction.findFirst.mockResolvedValue({ points: 150 })
    render(await OrderDetailRoute({ params: Promise.resolve({ id: '6123456789' }) }))

    expect(session.requireFreshSession).toHaveBeenCalledWith('/account/orders/6123456789')
    expect(queries.getCustomerOrder).toHaveBeenCalledWith('token-1', 'gid://shopify/Order/6123456789')
    expect(prisma.pointsTransaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ metadata: { contains: 'gid://shopify/Order/6123456789' } }) })
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Order #1012')
    expect(document.querySelector('[data-points-earned]')).toHaveTextContent('150')
  })

  it('omits the points line when the ledger has nothing for the order', async () => {
    queries.getCustomerOrder.mockResolvedValue(ORDER)
    render(await OrderDetailRoute({ params: Promise.resolve({ id: '6123456789' }) }))
    expect(document.querySelector('[data-points-earned]')).toBeNull()
  })

  it('404s for a malformed id or an order Shopify does not return', async () => {
    await expect(OrderDetailRoute({ params: Promise.resolve({ id: 'abc' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(queries.getCustomerOrder).not.toHaveBeenCalled()

    queries.getCustomerOrder.mockResolvedValue(null)
    await expect(OrderDetailRoute({ params: Promise.resolve({ id: '42' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
