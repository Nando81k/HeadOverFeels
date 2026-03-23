import { describe, expect, it } from 'vitest'
import type { Product } from '@/lib/api/products'
import {
  buildVariantInventoryUpdatePayload,
  filterProducts,
  getActiveFilterChips,
  getQuickFilterFromState,
  getStateFromQuickFilter,
  sortProducts,
} from '@/components/admin/products/product-management'

function createProduct(overrides: Partial<Product>): Product {
  return {
    id: overrides.id || 'product-1',
    name: overrides.name || 'Test Product',
    slug: overrides.slug || 'test-product',
    description: overrides.description || '',
    price: overrides.price ?? 100,
    images: overrides.images || JSON.stringify(['/test.jpg']),
    isActive: overrides.isActive ?? true,
    isFeatured: overrides.isFeatured ?? false,
    isFeaturedNewArrival: overrides.isFeaturedNewArrival,
    categoryId: overrides.categoryId,
    isLimitedEdition: overrides.isLimitedEdition,
    releaseDate: overrides.releaseDate,
    dropEndDate: overrides.dropEndDate,
    maxQuantity: overrides.maxQuantity,
    category: overrides.category,
    variants: overrides.variants || [],
    createdAt: overrides.createdAt || '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-01-01T00:00:00.000Z',
    compareAtPrice: overrides.compareAtPrice,
    materials: overrides.materials,
    careGuide: overrides.careGuide,
  }
}

describe('admin product management helper', () => {
  it('filters by search, status, stock, and margin', () => {
    const products = [
      createProduct({
        id: 'p1',
        name: 'Navy Hoodie',
        slug: 'navy-hoodie',
        isActive: true,
        variants: [{ id: 'v1', sku: 'SKU-1', inventory: 4, isActive: true }],
      }),
      createProduct({
        id: 'p2',
        name: 'Cream Tee',
        slug: 'cream-tee',
        isActive: false,
        variants: [{ id: 'v2', sku: 'SKU-2', inventory: 25, isActive: true }],
      }),
    ]

    const financials = new Map([
      ['p1', { marginPercent: 12, revenue: 500, unitsSold: 5 }],
      ['p2', { marginPercent: 45, revenue: 1200, unitsSold: 10 }],
    ])

    const result = filterProducts(products, financials, {
      search: 'navy',
      status: 'active',
      stock: 'low',
      margin: 'low',
    })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
  })

  it('sorts products by selected field and direction', () => {
    const products = [
      createProduct({
        id: 'p1',
        name: 'Zulu Tee',
        price: 40,
        variants: [{ id: 'v1', sku: 'SKU-1', inventory: 10, isActive: true }],
      }),
      createProduct({
        id: 'p2',
        name: 'Alpha Hoodie',
        price: 70,
        variants: [{ id: 'v2', sku: 'SKU-2', inventory: 2, isActive: true }],
      }),
    ]
    const financials = new Map([
      ['p1', { marginPercent: 20, revenue: 300, unitsSold: 5 }],
      ['p2', { marginPercent: 30, revenue: 900, unitsSold: 12 }],
    ])

    const byNameAsc = sortProducts(products, financials, 'name', 'asc')
    expect(byNameAsc.map((product) => product.id)).toEqual(['p2', 'p1'])

    const byRevenueDesc = sortProducts(products, financials, 'revenue', 'desc')
    expect(byRevenueDesc.map((product) => product.id)).toEqual(['p2', 'p1'])
  })

  it('returns active chips and supports quick filter mapping', () => {
    const chips = getActiveFilterChips({
      search: 'hoodie',
      status: 'active',
      stock: 'low',
      margin: 'all',
    })

    expect(chips.map((chip) => chip.key)).toEqual(['search', 'status', 'stock'])
    expect(getQuickFilterFromState('active', 'all')).toBe('active')
    expect(getStateFromQuickFilter('outOfStock')).toEqual({ status: 'all', stock: 'out' })
  })

  it('updates only the targeted variant inventory in payload builder', () => {
    const variants = [
      { id: 'va', sku: 'SKU-A', inventory: 3, isActive: true, size: 'S', color: 'Navy' },
      { id: 'vb', sku: 'SKU-B', inventory: 8, isActive: true, size: 'M', color: 'Navy' },
    ]

    const updated = buildVariantInventoryUpdatePayload(variants, 'vb', 15)

    expect(updated.find((variant) => variant.id === 'va')?.inventory).toBe(3)
    expect(updated.find((variant) => variant.id === 'vb')?.inventory).toBe(15)
  })
})
