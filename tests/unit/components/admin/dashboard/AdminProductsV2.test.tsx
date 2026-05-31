import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { isValidElement, type ReactElement } from 'react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/products',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ user: { id: '1', isAdmin: true, name: 'Admin', adminRole: 'ADMIN' } }),
}))

vi.mock('@/lib/admin/products', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/products')>(
    '@/lib/admin/products',
  )
  return {
    ...actual,
    loadProductsKpis: vi.fn(async () => ({
      active: 12,
      dropsLive: 3,
      lowStock: 5,
      drafts: 0,
    })),
    loadProductsTab: vi.fn(async () => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    })),
    loadCollections: vi.fn(async () => []),
    loadReviewsList: vi.fn(async () => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    })),
  }
})

// Stub heavy child views to keep this a focused composition smoke test.
vi.mock('@/components/admin/products/ProductsListView', () => ({
  ProductsListView: ({ rows }: { rows: Array<{ id: string }> }) => (
    <div data-testid="products-list-view">products-list rows={rows.length}</div>
  ),
}))

vi.mock('@/components/admin/products/CollectionsListView', () => ({
  CollectionsListView: ({ collections }: { collections: Array<{ id: string }> }) => (
    <div data-testid="collections-list-view">
      collections-list rows={collections.length}
    </div>
  ),
}))

vi.mock('@/components/admin/products/ReviewsListView', () => ({
  ReviewsListView: ({ reviews }: { reviews: Array<{ id: string }> }) => (
    <div data-testid="reviews-list-view">reviews-list rows={reviews.length}</div>
  ),
}))

beforeEach(() => {
  process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
})

/**
 * Recursively look for a React element whose type's name matches `name`.
 * Async server-component children show up as functions whose .name we can match.
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

describe('AdminProductsV2', () => {
  it('renders all 6 tab labels via TabPills', async () => {
    const { AdminProductsV2 } = await import(
      '@/components/admin/dashboard/AdminProductsV2'
    )
    const element = await AdminProductsV2({ searchParams: {} })
    render(element)

    expect(screen.getByRole('tab', { name: /All Products/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Active Drops/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Drafts/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Collections/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Reviews/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Archived/i })).toBeInTheDocument()
  })

  it('renders the filter bar placeholder', async () => {
    const { AdminProductsV2 } = await import(
      '@/components/admin/dashboard/AdminProductsV2'
    )
    const element = await AdminProductsV2({ searchParams: {} })
    render(element)
    expect(screen.getByText(/Filter bar — Phase 3\.5/)).toBeInTheDocument()
  })

  it('mounts the ProductsListTabSlot when no tab is given (defaults to all)', async () => {
    const { AdminProductsV2 } = await import(
      '@/components/admin/dashboard/AdminProductsV2'
    )
    const element = await AdminProductsV2({ searchParams: {} })
    const slot = findChildByTypeName(element, 'ProductsListTabSlot')
    expect(slot).not.toBeNull()
    expect((slot as ReactElement).props).toMatchObject({ tab: 'all' })
  })

  it('mounts the CollectionsListSlot when tab=collections', async () => {
    const { AdminProductsV2 } = await import(
      '@/components/admin/dashboard/AdminProductsV2'
    )
    const element = await AdminProductsV2({ searchParams: { tab: 'collections' } })
    expect(findChildByTypeName(element, 'CollectionsListSlot')).not.toBeNull()
    expect(findChildByTypeName(element, 'ProductsListTabSlot')).toBeNull()
  })

  it('mounts the ReviewsListSlot when tab=reviews', async () => {
    const { AdminProductsV2 } = await import(
      '@/components/admin/dashboard/AdminProductsV2'
    )
    const element = await AdminProductsV2({ searchParams: { tab: 'reviews' } })
    expect(findChildByTypeName(element, 'ReviewsListSlot')).not.toBeNull()
    expect(findChildByTypeName(element, 'ProductsListTabSlot')).toBeNull()
  })

  it('mounts the KpiStripSlot above the content slot', async () => {
    const { AdminProductsV2 } = await import(
      '@/components/admin/dashboard/AdminProductsV2'
    )
    const element = await AdminProductsV2({ searchParams: {} })
    expect(findChildByTypeName(element, 'KpiStripSlot')).not.toBeNull()
  })

  it('falls back to the all tab when given an invalid tab value', async () => {
    const { AdminProductsV2 } = await import(
      '@/components/admin/dashboard/AdminProductsV2'
    )
    const element = await AdminProductsV2({ searchParams: { tab: 'bogus' } })
    const slot = findChildByTypeName(element, 'ProductsListTabSlot')
    expect(slot).not.toBeNull()
    expect((slot as ReactElement).props).toMatchObject({ tab: 'all' })
  })

  it('passes a valid drops tab through to the products list slot', async () => {
    const { AdminProductsV2 } = await import(
      '@/components/admin/dashboard/AdminProductsV2'
    )
    const element = await AdminProductsV2({ searchParams: { tab: 'drops' } })
    const slot = findChildByTypeName(element, 'ProductsListTabSlot')
    expect((slot as ReactElement).props).toMatchObject({ tab: 'drops' })
  })
})
