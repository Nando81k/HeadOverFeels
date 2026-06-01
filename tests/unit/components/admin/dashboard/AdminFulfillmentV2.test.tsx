import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { isValidElement, type ReactElement } from 'react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/fulfillment',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ user: { id: '1', isAdmin: true, name: 'Admin', adminRole: 'ADMIN' } }),
}))

vi.mock('@/lib/admin/fulfillment', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/fulfillment')>(
    '@/lib/admin/fulfillment',
  )
  return {
    ...actual,
    loadFulfillmentKpis: vi.fn(async () => ({
      needsActionCount: 3,
      readyToShipCount: 5,
      todaysRevenue: 200,
      returnsPendingCount: 1,
    })),
    loadOrdersTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
    loadReturnsTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
    loadArchivedTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
  }
})

// Stub heavy child views to keep this a focused composition smoke test.
vi.mock('@/components/admin/fulfillment/OrdersListView', () => ({
  OrdersListView: ({ rows }: { rows: Array<{ id: string }> }) => (
    <div data-testid="orders-list-view">orders-list rows={rows.length}</div>
  ),
}))

vi.mock('@/components/admin/fulfillment/ReturnsListView', () => ({
  ReturnsListView: ({ rows }: { rows: Array<{ id: string }> }) => (
    <div data-testid="returns-list-view">returns-list rows={rows.length}</div>
  ),
}))

vi.mock('@/components/admin/fulfillment/ArchivedListView', () => ({
  ArchivedListView: ({ rows }: { rows: Array<{ id: string }> }) => (
    <div data-testid="archived-list-view">archived-list rows={rows.length}</div>
  ),
}))

vi.mock('@/components/admin/fulfillment/NewOrderToast', () => ({
  NewOrderToast: () => <div data-testid="new-order-toast" />,
}))

beforeEach(() => {
  process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
})

/**
 * Recursively look for a React element whose type's name matches `name`.
 * Async server-component children show up as functions whose .name we can match
 * (their Suspense children don't resolve through RTL in jsdom).
 */
function findChildByTypeName(
  node: unknown,
  name: string,
): ReactElement | null {
  if (!node) return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findChildByTypeName(child, name)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  const type = node.type as { name?: string; displayName?: string } | string
  const typeName = typeof type === 'string' ? type : type.name ?? type.displayName
  if (typeName === name) return node
  const props = node.props as { children?: unknown }
  return findChildByTypeName(props.children, name)
}

describe('AdminFulfillmentV2', () => {
  it('renders all 7 tab labels via TabPills', async () => {
    const { AdminFulfillmentV2 } = await import(
      '@/components/admin/dashboard/AdminFulfillmentV2'
    )
    const element = await AdminFulfillmentV2({ searchParams: {} })
    render(element)

    expect(screen.getByRole('tab', { name: /All Orders/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Needs Action/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Processing/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Shipped/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Delivered/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Returns/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Archived/i })).toBeInTheDocument()
  })

  it('renders the filter bar placeholder', async () => {
    const { AdminFulfillmentV2 } = await import(
      '@/components/admin/dashboard/AdminFulfillmentV2'
    )
    const element = await AdminFulfillmentV2({ searchParams: {} })
    render(element)
    expect(screen.getByText(/Filter bar — Phase 4\.5/)).toBeInTheDocument()
  })

  it('mounts the OrdersListTabSlot when no tab is given (defaults to all)', async () => {
    const { AdminFulfillmentV2 } = await import(
      '@/components/admin/dashboard/AdminFulfillmentV2'
    )
    const element = await AdminFulfillmentV2({ searchParams: {} })
    const slot = findChildByTypeName(element, 'OrdersListTabSlot')
    expect(slot).not.toBeNull()
    expect((slot as ReactElement).props).toMatchObject({ tab: 'all' })
  })

  it('mounts the ReturnsListSlot when tab=returns', async () => {
    const { AdminFulfillmentV2 } = await import(
      '@/components/admin/dashboard/AdminFulfillmentV2'
    )
    const element = await AdminFulfillmentV2({ searchParams: { tab: 'returns' } })
    expect(findChildByTypeName(element, 'ReturnsListSlot')).not.toBeNull()
    expect(findChildByTypeName(element, 'OrdersListTabSlot')).toBeNull()
  })

  it('mounts the ArchivedListSlot when tab=archived', async () => {
    const { AdminFulfillmentV2 } = await import(
      '@/components/admin/dashboard/AdminFulfillmentV2'
    )
    const element = await AdminFulfillmentV2({ searchParams: { tab: 'archived' } })
    expect(findChildByTypeName(element, 'ArchivedListSlot')).not.toBeNull()
    expect(findChildByTypeName(element, 'OrdersListTabSlot')).toBeNull()
  })

  it('passes the needs-action tab through to the orders list slot', async () => {
    const { AdminFulfillmentV2 } = await import(
      '@/components/admin/dashboard/AdminFulfillmentV2'
    )
    const element = await AdminFulfillmentV2({ searchParams: { tab: 'needs-action' } })
    const slot = findChildByTypeName(element, 'OrdersListTabSlot')
    expect((slot as ReactElement).props).toMatchObject({ tab: 'needs-action' })
  })

  it('mounts the KpiStripSlot above the content slot', async () => {
    const { AdminFulfillmentV2 } = await import(
      '@/components/admin/dashboard/AdminFulfillmentV2'
    )
    const element = await AdminFulfillmentV2({ searchParams: {} })
    expect(findChildByTypeName(element, 'KpiStripSlot')).not.toBeNull()
  })

  it('mounts NewOrderToast', async () => {
    const { AdminFulfillmentV2 } = await import(
      '@/components/admin/dashboard/AdminFulfillmentV2'
    )
    const element = await AdminFulfillmentV2({ searchParams: {} })
    render(element)
    expect(screen.getByTestId('new-order-toast')).toBeInTheDocument()
  })

  it('falls back to the all tab when given an invalid tab value', async () => {
    const { AdminFulfillmentV2 } = await import(
      '@/components/admin/dashboard/AdminFulfillmentV2'
    )
    const element = await AdminFulfillmentV2({ searchParams: { tab: 'bogus' } })
    const slot = findChildByTypeName(element, 'OrdersListTabSlot')
    expect(slot).not.toBeNull()
    expect((slot as ReactElement).props).toMatchObject({ tab: 'all' })
  })
})
