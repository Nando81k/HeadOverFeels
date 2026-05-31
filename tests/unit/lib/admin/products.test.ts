// tests/unit/lib/admin/products.test.ts
import { describe, it, expect } from 'vitest'
import { TABS, isProductsTab } from '@/lib/admin/products'

describe('Products data layer', () => {
  it('exports TABS as the 6 canonical tabs', () => {
    expect(TABS).toEqual(['all', 'drops', 'drafts', 'collections', 'reviews', 'archived'])
  })

  it('isProductsTab returns true for known tabs', () => {
    expect(isProductsTab('all')).toBe(true)
    expect(isProductsTab('reviews')).toBe(true)
  })

  it('isProductsTab returns false for unknown values', () => {
    expect(isProductsTab('unknown')).toBe(false)
    expect(isProductsTab(undefined)).toBe(false)
  })
})
