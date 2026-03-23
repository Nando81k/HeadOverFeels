import { describe, expect, it } from 'vitest'
import type { Product } from '@/lib/api/products'
import { resolveWishlistQuickAdd } from '@/lib/wishlist/wishlist-quick-add'

function createProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    name: 'Test Product',
    slug: 'test-product',
    price: 90,
    images: '[]',
    isActive: true,
    isFeatured: false,
    variants: [
      {
        id: 'variant-1',
        sku: 'SKU-1',
        inventory: 4,
        isActive: true,
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('wishlist quick add resolver', () => {
  it('adds directly when saved variant is active and in stock', () => {
    const result = resolveWishlistQuickAdd({
      product: {
        id: 'product-1',
        name: 'Test Product',
        slug: 'test-product',
        price: 90,
        images: '[]',
        isActive: true,
      },
      productVariant: {
        id: 'variant-1',
        sku: 'SKU-1',
        inventory: 2,
        isActive: true,
      },
    })

    expect(result.outcome).toBe('added')
    expect(result.variant?.id).toBe('variant-1')
  })

  it('requires selection when multiple in-stock variants exist and none is saved', () => {
    const product = createProduct({
      variants: [
        { id: 'v1', sku: 'V1', inventory: 2, isActive: true },
        { id: 'v2', sku: 'V2', inventory: 1, isActive: true },
      ],
    })

    const result = resolveWishlistQuickAdd(
      {
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          images: product.images,
          isActive: true,
        },
      },
      product
    )

    expect(result.outcome).toBe('requiresSelection')
  })

  it('returns outOfStock when no active/in-stock variants are available', () => {
    const product = createProduct({
      variants: [{ id: 'v1', sku: 'V1', inventory: 0, isActive: true }],
    })

    const result = resolveWishlistQuickAdd(
      {
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          images: product.images,
          isActive: true,
        },
      },
      product
    )

    expect(result.outcome).toBe('outOfStock')
  })
})
