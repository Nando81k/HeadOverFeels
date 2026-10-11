// tests/unit/storefront/seo.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { normalizeProduct, type RawProductDetail } from '@/lib/shopify/queries/product'
import type { CollectionSummary, ProductCardData, ProductDetail } from '@/lib/shopify/types'
import {
  breadcrumbJsonLd,
  collectionJsonLd,
  jsonLdScriptProps,
  organizationJsonLd,
  productJsonLd,
  siteUrl,
  stripHtml,
  truncate,
} from '@/lib/storefront/seo'
import productFixture from '@/tests/fixtures/shopify/product-by-handle.json'

const product: ProductDetail = normalizeProduct(
  productFixture.product as unknown as RawProductDetail
)

const inStock = product.variants.find((v) => v.title === 'M / Black')!
const soldOut = product.variants.find((v) => v.title === 'S / Black')!

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_BASE_URL
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_BASE_URL
})

describe('siteUrl', () => {
  it('defaults to the production origin', () => {
    expect(siteUrl()).toBe('https://headoverfeels.com')
    expect(siteUrl('/products/core-hoodie')).toBe('https://headoverfeels.com/products/core-hoodie')
  })

  it('reads NEXT_PUBLIC_BASE_URL and never doubles a slash', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://preview.example.com/'

    expect(siteUrl()).toBe('https://preview.example.com')
    expect(siteUrl('/drops')).toBe('https://preview.example.com/drops')
    expect(siteUrl('drops')).toBe('https://preview.example.com/drops')
  })
})

describe('stripHtml / truncate', () => {
  it('strips tags and decodes the common entities', () => {
    expect(stripHtml('<p>Boxy body, <strong>dropped</strong> shoulder.</p>')).toBe(
      'Boxy body, dropped shoulder.'
    )
    expect(stripHtml('<p>Tees &amp; hoodies</p>')).toBe('Tees & hoodies')
    expect(stripHtml('')).toBe('')
  })

  it('truncates on a word boundary and never exceeds the limit', () => {
    const long = 'a'.repeat(50) + ' tail'

    expect(truncate('short', 160)).toBe('short')
    expect(truncate(long, 20).length).toBeLessThanOrEqual(20)
    expect(truncate(long, 20).endsWith('…')).toBe(true)
  })
})

describe('productJsonLd', () => {
  it('describes the product and the selected offer', () => {
    const schema = productJsonLd(product, inStock) as Record<string, unknown>

    expect(schema['@context']).toBe('https://schema.org')
    expect(schema['@type']).toBe('Product')
    expect(schema.name).toBe('Core Hoodie')
    expect(schema.description).not.toContain('<')
    expect(schema.description).toContain('everyday hoodie')
    expect(schema.image).toEqual(product.images.map((image) => image.url))
    expect(schema.sku).toBe('HOF-CH-BLK-M')
    expect(schema.brand).toEqual({ '@type': 'Brand', name: 'Head Over Feels' })

    const offer = schema.offers as Record<string, unknown>
    expect(offer['@type']).toBe('Offer')
    expect(offer.price).toBe('88.0')
    expect(offer.priceCurrency).toBe('USD')
    expect(offer.availability).toBe('https://schema.org/InStock')
    expect(offer.itemCondition).toBe('https://schema.org/NewCondition')
    expect(offer.url).toBe('https://headoverfeels.com/products/core-hoodie?Size=M&Color=Black')
  })

  it('marks a sold-out variant OutOfStock', () => {
    const schema = productJsonLd(product, soldOut) as Record<string, unknown>
    const offer = schema.offers as Record<string, unknown>

    expect(offer.availability).toBe('https://schema.org/OutOfStock')
    expect(offer.url).toBe('https://headoverfeels.com/products/core-hoodie?Size=S&Color=Black')
  })

  it('falls back to the product price and canonical URL with no variant', () => {
    const schema = productJsonLd(product, null) as Record<string, unknown>
    const offer = schema.offers as Record<string, unknown>

    expect(schema.sku).toBeUndefined()
    expect(offer.price).toBe(product.price.amount)
    expect(offer.url).toBe('https://headoverfeels.com/products/core-hoodie')
  })
})

describe('breadcrumbJsonLd', () => {
  it('numbers the trail from 1', () => {
    const schema = breadcrumbJsonLd([
      { name: 'Home', url: siteUrl('/') },
      { name: 'Shop', url: siteUrl('/collections/all') },
    ]) as Record<string, unknown>

    expect(schema['@type']).toBe('BreadcrumbList')
    expect(schema.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://headoverfeels.com/' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Shop',
        item: 'https://headoverfeels.com/collections/all',
      },
    ])
  })
})

describe('collectionJsonLd / organizationJsonLd', () => {
  const collection: CollectionSummary = {
    id: 'gid://shopify/Collection/1',
    handle: 'hoodies',
    title: 'Hoodies',
    image: null,
    description: 'Heavyweight fleece.',
    featured: true,
  }
  const cards: ProductCardData[] = [product]

  it('lists the collection products as an ItemList', () => {
    const schema = collectionJsonLd(collection, cards) as Record<string, unknown>

    expect(schema['@type']).toBe('CollectionPage')
    expect(schema.url).toBe('https://headoverfeels.com/collections/hoodies')
    const list = schema.mainEntity as Record<string, unknown>
    expect(list['@type']).toBe('ItemList')
    expect(list.numberOfItems).toBe(1)
    expect(list.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Core Hoodie',
        url: 'https://headoverfeels.com/products/core-hoodie',
      },
    ])
  })

  it('describes the store', () => {
    const schema = organizationJsonLd() as Record<string, unknown>

    expect(schema['@type']).toBe('Organization')
    expect(schema.name).toBe('Head Over Feels')
    expect(schema.url).toBe('https://headoverfeels.com')
  })
})

describe('jsonLdScriptProps', () => {
  it('returns script props with an escaped payload', () => {
    const props = jsonLdScriptProps({ '@type': 'Product', name: '</script><img src=x>' })

    expect(props.type).toBe('application/ld+json')
    expect(props.dangerouslySetInnerHTML.__html).not.toContain('</script>')
    expect(props.dangerouslySetInnerHTML.__html).toContain('\\u003c')
    expect(JSON.parse(props.dangerouslySetInnerHTML.__html)).toEqual({
      '@type': 'Product',
      name: '</script><img src=x>',
    })
  })
})
