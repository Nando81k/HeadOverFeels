// tests/unit/storefront/variants.test.ts
import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'

// `lib/shopify/queries/product` pulls in `lib/shopify/client`, which imports
// `server-only` — a module that throws outside a React Server environment.
vi.mock('server-only', () => ({}))

import { normalizeProduct, type RawProductDetail } from '@/lib/shopify/queries/product'
import type { ProductDetail } from '@/lib/shopify/types'
import {
  optionValueAvailability,
  selectVariant,
  selectedOptionsToParams,
  variantHref,
} from '@/lib/storefront/variants'
import productFixture from '@/tests/fixtures/shopify/product-by-handle.json'

/** 12 variants (S/M/L/XL × Black/Taupe/Bone); `S / Black` is the sold-out one. */
const product: ProductDetail = normalizeProduct(
  productFixture.product as unknown as RawProductDetail
)

/** Same catalogue with a hand-picked variant list (option values are untouched). */
function withVariants(titles: string[]): ProductDetail {
  return { ...product, variants: product.variants.filter((v) => titles.includes(v.title)) }
}

describe('selectVariant', () => {
  it('falls back to the first available variant when no options are in the URL', () => {
    const { selected, selectedOptions, complete } = selectVariant(product, {})

    // `S / Black` is first in the list but sold out.
    expect(selected?.title).toBe('S / Taupe')
    expect(selectedOptions).toEqual({ Size: 'S', Color: 'Taupe' })
    expect(complete).toBe(true)
  })

  it('falls back to the first variant when nothing is available', () => {
    const soldOut = withVariants(['S / Black'])

    expect(selectVariant(soldOut, {}).selected?.title).toBe('S / Black')
  })

  it('matches option names case-insensitively', () => {
    const { selected, selectedOptions } = selectVariant(product, { size: 'L', color: 'Bone' })

    expect(selected?.title).toBe('L / Bone')
    expect(selectedOptions).toEqual({ Size: 'L', Color: 'Bone' })
  })

  it('accepts a URLSearchParams as well as a plain record', () => {
    const params = new URLSearchParams({ Size: 'XL', Color: 'Taupe' })

    expect(selectVariant(product, params).selected?.title).toBe('XL / Taupe')
  })

  it('fills the remaining options from the first matching variant, preferring available', () => {
    const { selected, selectedOptions, complete } = selectVariant(product, { Size: 'S' })

    // S / Black exists but is sold out, so the Colour is completed with Taupe.
    expect(selected?.title).toBe('S / Taupe')
    expect(selectedOptions).toEqual({ Size: 'S', Color: 'Taupe' })
    expect(complete).toBe(true)
  })

  it('ignores values that are not option values of the product', () => {
    const { selected, selectedOptions } = selectVariant(product, { Size: 'XS', Nope: 'x' })

    expect(selected?.title).toBe('S / Taupe')
    expect(selectedOptions).toEqual({ Size: 'S', Color: 'Taupe' })
  })

  it('keeps the requested options and reports incomplete when no variant matches', () => {
    const empty: ProductDetail = { ...product, variants: [] }

    const { selected, selectedOptions, complete } = selectVariant(empty, { Size: 'M' })

    expect(selected).toBeNull()
    expect(selectedOptions).toEqual({ Size: 'M' })
    expect(complete).toBe(false)
  })
})

describe('variantHref', () => {
  it('keeps the other selected options and swaps the changed one', () => {
    const href = variantHref(
      '/products/core-hoodie',
      { Size: 'M', Color: 'Black' },
      { name: 'Color', value: 'Bone' }
    )

    expect(href).toBe('/products/core-hoodie?Size=M&Color=Bone')
  })

  it('appends an option that was not selected yet', () => {
    expect(variantHref('/products/x', { Size: 'M' }, { name: 'Color', value: 'Bone' })).toBe(
      '/products/x?Size=M&Color=Bone'
    )
  })

  it('encodes names and values', () => {
    const href = variantHref('/products/x', {}, { name: 'Colour way', value: 'Off White & Bone' })

    expect(href).toBe('/products/x?Colour+way=Off+White+%26+Bone')
    expect(new URL(href, 'https://example.com').searchParams.get('Colour way')).toBe(
      'Off White & Bone'
    )
  })

  it('returns the bare pathname when nothing is selected', () => {
    expect(variantHref('/products/x', {}, { name: 'Size', value: '' })).toBe('/products/x')
  })
})

describe('optionValueAvailability', () => {
  const selected = { Size: 'S', Color: 'Black' }

  it('is available when the combination exists and is in stock', () => {
    expect(optionValueAvailability(product, selected, 'Color', 'Taupe')).toBe('available')
    expect(optionValueAvailability(product, selected, 'Size', 'M')).toBe('available')
  })

  it('is soldout when the combination exists but is out of stock', () => {
    expect(optionValueAvailability(product, selected, 'Color', 'Black')).toBe('soldout')
    expect(optionValueAvailability(product, selected, 'Size', 'S')).toBe('soldout')
  })

  it('is unavailable when no variant combines the value with the current selection', () => {
    // Bone exists — but not in XL.
    const trimmed = withVariants(product.variants.map((v) => v.title).filter((t) => t !== 'XL / Bone'))

    expect(optionValueAvailability(trimmed, { Size: 'XL', Color: 'Black' }, 'Color', 'Bone')).toBe(
      'unavailable'
    )
    expect(optionValueAvailability(trimmed, { Size: 'M', Color: 'Bone' }, 'Size', 'XL')).toBe(
      'unavailable'
    )
  })

  it('ignores the option being asked about when it is already selected', () => {
    expect(optionValueAvailability(product, { Color: 'Bone' }, 'Color', 'Black')).toBe('available')
  })
})

describe('selectedOptionsToParams', () => {
  it('keeps insertion order and returns a URLSearchParams', () => {
    const params = selectedOptionsToParams({ Size: 'M', Color: 'Bone' })

    expect(params).toBeInstanceOf(URLSearchParams)
    expect(params.toString()).toBe('Size=M&Color=Bone')
  })

  it('drops empty values', () => {
    expect(selectedOptionsToParams({ Size: '', Color: 'Bone' }).toString()).toBe('Color=Bone')
  })
})
