import { describe, expect, it } from 'vitest'
import { Product } from '@/lib/api/products'
import {
  applyProductFilters,
  deriveAvailableColors,
  getDefaultFilterState,
  parseFilterStateFromSearchParams,
  serializeFilterStateToSearchParams,
} from '@/components/products/product-filtering'

function createProduct(overrides: Partial<Product>): Product {
  return {
    id: overrides.id || 'prod-1',
    name: overrides.name || 'Test Product',
    slug: overrides.slug || 'test-product',
    description: overrides.description || 'Product description',
    price: overrides.price ?? 100,
    images: overrides.images || JSON.stringify(['/image.jpg']),
    isActive: overrides.isActive ?? true,
    isFeatured: overrides.isFeatured ?? false,
    variants: overrides.variants || [],
    createdAt: overrides.createdAt || '2026-03-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-03-01T00:00:00.000Z',
    category: overrides.category,
    compareAtPrice: overrides.compareAtPrice,
    categoryId: overrides.categoryId,
    materials: overrides.materials,
    careGuide: overrides.careGuide,
    isFeaturedNewArrival: overrides.isFeaturedNewArrival,
    isLimitedEdition: overrides.isLimitedEdition,
    releaseDate: overrides.releaseDate,
    dropEndDate: overrides.dropEndDate,
    maxQuantity: overrides.maxQuantity,
  }
}

describe('product filtering helper', () => {
  it('parses and serializes URL filter state while omitting defaults', () => {
    const bounds = { min: 20, max: 220 }
    const params = new URLSearchParams(
      'search=  Hoodie  &sizes=m,s,m&colors=Navy,cream&minPrice=10&maxPrice=999&inStock=true&sortBy=price-desc&utm=test'
    )

    const parsed = parseFilterStateFromSearchParams(params, bounds)

    expect(parsed).toEqual({
      search: 'Hoodie',
      priceRange: [20, 220],
      sizes: ['S', 'M'],
      colors: ['cream', 'navy'],
      inStockOnly: true,
      sortBy: 'price-desc',
    })

    const serializedDefault = serializeFilterStateToSearchParams(
      new URLSearchParams('utm=test'),
      getDefaultFilterState(bounds),
      bounds
    )

    expect(serializedDefault.toString()).toBe('utm=test')

    const serialized = serializeFilterStateToSearchParams(
      new URLSearchParams('utm=test'),
      parsed,
      bounds
    )

    expect(serialized.get('utm')).toBe('test')
    expect(serialized.get('search')).toBe('Hoodie')
    expect(serialized.get('sizes')).toBe('S,M')
    expect(serialized.get('colors')).toBe('cream,navy')
    expect(serialized.get('inStock')).toBe('true')
    expect(serialized.get('sortBy')).toBe('price-desc')
    expect(serialized.get('minPrice')).toBeNull()
    expect(serialized.get('maxPrice')).toBeNull()
  })

  it('sanitizes invalid and out-of-range query params', () => {
    const bounds = { min: 30, max: 180 }
    const params = new URLSearchParams(
      'minPrice=bad&maxPrice=15&sizes=, xl ,xl&colors=, navy&sortBy=unknown&inStock=false'
    )

    const parsed = parseFilterStateFromSearchParams(params, bounds)

    expect(parsed.priceRange).toEqual([30, 30])
    expect(parsed.sizes).toEqual(['XL'])
    expect(parsed.colors).toEqual(['navy'])
    expect(parsed.sortBy).toBe('newest')
    expect(parsed.inStockOnly).toBe(false)
  })

  it('applies strict same-variant matching for size + color', () => {
    const product = createProduct({
      id: 'strict-1',
      name: 'Split Variant Hoodie',
      variants: [
        {
          id: 'v-s-red',
          sku: 'SKU-S-RED',
          size: 'S',
          color: 'Red',
          inventory: 5,
          isActive: true,
        },
        {
          id: 'v-m-blue',
          sku: 'SKU-M-BLUE',
          size: 'M',
          color: 'Blue',
          inventory: 5,
          isActive: true,
        },
      ],
    })

    const filters = {
      search: '',
      priceRange: [0, 500] as [number, number],
      sizes: ['S'],
      colors: ['blue'],
      inStockOnly: false,
      sortBy: 'newest' as const,
    }

    const result = applyProductFilters([product], filters)
    expect(result).toHaveLength(0)
  })

  it('handles in-stock behavior correctly with and without variant facet filters', () => {
    const product = createProduct({
      id: 'stock-1',
      name: 'Stock Test Tee',
      variants: [
        {
          id: 'v-s-red-oos',
          sku: 'SKU-S-RED-OOS',
          size: 'S',
          color: 'Red',
          inventory: 0,
          isActive: true,
        },
        {
          id: 'v-m-red-live',
          sku: 'SKU-M-RED-LIVE',
          size: 'M',
          color: 'Red',
          inventory: 7,
          isActive: true,
        },
      ],
    })

    const inStockNoFacet = applyProductFilters(
      [product],
      {
        search: '',
        priceRange: [0, 500],
        sizes: [],
        colors: [],
        inStockOnly: true,
        sortBy: 'newest',
      },
      undefined
    )

    expect(inStockNoFacet).toHaveLength(1)

    const inStockWithFacet = applyProductFilters(
      [product],
      {
        search: '',
        priceRange: [0, 500],
        sizes: ['S'],
        colors: ['red'],
        inStockOnly: true,
        sortBy: 'newest',
      },
      undefined
    )

    expect(inStockWithFacet).toHaveLength(0)
  })

  it('derives color options with colorHex fallback and per-product counting', () => {
    const products = [
      createProduct({
        id: 'color-1',
        variants: [
          {
            id: 'v-1',
            sku: 'SKU-1',
            colorHex: '#112233',
            inventory: 4,
            isActive: true,
          },
          {
            id: 'v-2',
            sku: 'SKU-2',
            colorHex: '#112233',
            inventory: 1,
            isActive: true,
          },
        ],
      }),
      createProduct({
        id: 'color-2',
        variants: [
          {
            id: 'v-3',
            sku: 'SKU-3',
            color: 'Navy',
            colorHex: '#001F3F',
            inventory: 3,
            isActive: true,
          },
          {
            id: 'v-4',
            sku: 'SKU-4',
            colorHex: '#112233',
            inventory: 2,
            isActive: true,
          },
        ],
      }),
    ]

    const colors = deriveAvailableColors(products)
    const fallback = colors.find((option) => option.key === '#112233')
    const navy = colors.find((option) => option.key === 'navy')

    expect(fallback).toBeDefined()
    expect(fallback?.count).toBe(2)
    expect(fallback?.hex).toBe('#112233')

    expect(navy).toBeDefined()
    expect(navy?.label).toBe('Navy')
    expect(navy?.hex).toBe('#001F3F')
  })
})
