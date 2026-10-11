// tests/unit/shopify/product-query.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

// `lib/shopify/client` imports `server-only`; the module is mocked below, but the
// guard keeps the import safe if the mock factory is ever removed.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

import { storefrontFetch } from '@/lib/shopify/client'
import {
  IMAGE_FIELDS,
  MONEY_FIELDS,
  PRODUCT_CARD_FIELDS,
  toImage,
  toProductCard,
  type RawProductCard,
} from '@/lib/shopify/queries/fragments'
import {
  PRODUCT_BY_HANDLE_QUERY,
  getProduct,
  normalizeProduct,
  type RawProductDetail,
} from '@/lib/shopify/queries/product'
import productFixture from '@/tests/fixtures/shopify/product-by-handle.json'

const rawProduct = productFixture.product as unknown as RawProductDetail
const mocked = () => vi.mocked(storefrontFetch)

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

const money = (amount: string) => ({ amount, currencyCode: 'USD' })
const image = (url: string) => ({ url, altText: null, width: 1000, height: 1250 })

function card(overrides: Partial<RawProductCard> = {}): RawProductCard {
  return {
    id: 'gid://shopify/Product/1',
    handle: 'test-product',
    title: 'Test Product',
    availableForSale: true,
    tags: [],
    featuredImage: image('https://cdn.shopify.com/a.jpg'),
    images: { nodes: [image('https://cdn.shopify.com/a.jpg'), image('https://cdn.shopify.com/b.jpg')] },
    priceRange: { minVariantPrice: money('40.0') },
    compareAtPriceRange: { minVariantPrice: money('0.0') },
    options: [],
    ...overrides,
  }
}

beforeEach(() => {
  mocked().mockReset()
})

describe('fragments', () => {
  it('composes ProductCardFields with ImageFields and MoneyFields exactly once', () => {
    expect(PRODUCT_CARD_FIELDS).toContain('fragment ProductCardFields on Product')
    expect(PRODUCT_CARD_FIELDS).toContain('images(first: 2)')
    expect(occurrences(PRODUCT_CARD_FIELDS, 'fragment ImageFields on Image')).toBe(1)
    expect(occurrences(PRODUCT_CARD_FIELDS, 'fragment MoneyFields on MoneyV2')).toBe(1)
    expect(IMAGE_FIELDS).toContain('fragment ImageFields on Image')
    expect(MONEY_FIELDS).toContain('fragment MoneyFields on MoneyV2')
  })
})

describe('toImage', () => {
  it('returns null for a missing image', () => {
    expect(toImage(null)).toBeNull()
    expect(toImage(undefined)).toBeNull()
  })

  it('maps url, altText and dimensions', () => {
    expect(toImage({ url: 'https://cdn.shopify.com/x.jpg', altText: 'x', width: 10, height: 20 })).toEqual({
      url: 'https://cdn.shopify.com/x.jpg',
      altText: 'x',
      width: 10,
      height: 20,
    })
  })
})

describe('toProductCard', () => {
  it('uses featuredImage as the primary image and the next distinct image as hover', () => {
    const result = toProductCard(rawProduct)
    expect(result.image?.url).toContain('core-hoodie-black-front.jpg')
    expect(result.hoverImage?.url).toContain('core-hoodie-black-back.jpg')
  })

  it('falls back to the first images node when featuredImage is null', () => {
    const result = toProductCard(card({ featuredImage: null }))
    expect(result.image?.url).toBe('https://cdn.shopify.com/a.jpg')
    expect(result.hoverImage?.url).toBe('https://cdn.shopify.com/b.jpg')
  })

  it('returns a null hoverImage when there is no second distinct image', () => {
    const only = image('https://cdn.shopify.com/a.jpg')
    const result = toProductCard(card({ featuredImage: only, images: { nodes: [only] } }))
    expect(result.image?.url).toBe('https://cdn.shopify.com/a.jpg')
    expect(result.hoverImage).toBeNull()
    expect(toProductCard(card({ featuredImage: null, images: { nodes: [] } })).image).toBeNull()
  })

  it('exposes compareAtPrice only when it is numerically higher than the price', () => {
    expect(toProductCard(rawProduct).compareAtPrice).toBeNull()
    expect(
      toProductCard(card({ compareAtPriceRange: { minVariantPrice: money('40.0') } })).compareAtPrice
    ).toBeNull()
    expect(
      toProductCard(card({ compareAtPriceRange: { minVariantPrice: money('60.0') } })).compareAtPrice
    ).toEqual(money('60.0'))
    expect(toProductCard(card({ compareAtPriceRange: null })).compareAtPrice).toBeNull()
  })

  it('builds swatches from the Color option, null when the option value has no swatch', () => {
    expect(toProductCard(rawProduct).swatches).toEqual([
      { name: 'Black', color: '#1a1a1a' },
      { name: 'Taupe', color: '#8c7b6b' },
      { name: 'Bone', color: null },
    ])
  })

  it('accepts the British "Colour" spelling and ignores non-colour options', () => {
    const result = toProductCard(
      card({
        options: [
          { name: 'Size', optionValues: [{ name: 'S', swatch: null }] },
          { name: 'Colour', optionValues: [{ name: 'Bone', swatch: { color: '#e8e2d9' } }] },
        ],
      })
    )
    expect(result.swatches).toEqual([{ name: 'Bone', color: '#e8e2d9' }])
    expect(toProductCard(card()).swatches).toEqual([])
  })

  it('orders badges sale, drop, new, soldout', () => {
    expect(toProductCard(rawProduct).badges).toEqual(['new'])
    const everything = toProductCard(
      card({
        availableForSale: false,
        tags: ['drop', 'new-arrival'],
        compareAtPriceRange: { minVariantPrice: money('60.0') },
      })
    )
    expect(everything.badges).toEqual(['sale', 'drop', 'new', 'soldout'])
    expect(toProductCard(card({ tags: ['drop'] })).badges).toEqual(['drop'])
  })

  it('copies through identity and availability', () => {
    const result = toProductCard(rawProduct)
    expect(result).toMatchObject({
      id: 'gid://shopify/Product/8123456789012',
      handle: 'core-hoodie',
      title: 'Core Hoodie',
      availableForSale: true,
      price: money('88.0'),
    })
  })
})

describe('PRODUCT_BY_HANDLE_QUERY', () => {
  it('is the validated 2026-07 document with the gallery alias and one copy of each fragment', () => {
    expect(PRODUCT_BY_HANDLE_QUERY).toContain('query ProductByHandle($handle: String!)')
    expect(PRODUCT_BY_HANDLE_QUERY).toContain('...ProductCardFields')
    expect(PRODUCT_BY_HANDLE_QUERY).toContain('gallery: images(first: 12)')
    expect(PRODUCT_BY_HANDLE_QUERY).toContain('colorHex: metafield(namespace: "custom", key: "color_hex")')
    expect(PRODUCT_BY_HANDLE_QUERY).toContain('maxPerOrder: metafield(namespace: "custom", key: "max_per_order")')
    expect(occurrences(PRODUCT_BY_HANDLE_QUERY, 'fragment ImageFields on Image')).toBe(1)
    expect(occurrences(PRODUCT_BY_HANDLE_QUERY, 'fragment MoneyFields on MoneyV2')).toBe(1)
    expect(occurrences(PRODUCT_BY_HANDLE_QUERY, 'fragment ProductCardFields on Product')).toBe(1)
  })
})

describe('normalizeProduct', () => {
  it('maps the gallery alias to images', () => {
    const product = normalizeProduct(rawProduct)
    expect(product.images).toHaveLength(5)
    expect(product.images[0].url).toContain('core-hoodie-black-front.jpg')
    expect(product.images[4]).toEqual({
      url: expect.stringContaining('core-hoodie-detail-cuff.jpg'),
      altText: null,
      width: 1600,
      height: 1600,
    })
  })

  it('maps options with ids and swatchColor', () => {
    const [size, color] = normalizeProduct(rawProduct).options
    expect(size).toMatchObject({ id: 'gid://shopify/ProductOption/10123456789012', name: 'Size' })
    expect(size.values.map((v) => v.name)).toEqual(['S', 'M', 'L', 'XL'])
    expect(size.values.every((v) => v.swatchColor === null)).toBe(true)
    expect(color.values).toEqual([
      { id: 'gid://shopify/ProductOptionValue/20123456789020', name: 'Black', swatchColor: '#1a1a1a' },
      { id: 'gid://shopify/ProductOptionValue/20123456789021', name: 'Taupe', swatchColor: '#8c7b6b' },
      { id: 'gid://shopify/ProductOptionValue/20123456789022', name: 'Bone', swatchColor: null },
    ])
  })

  it('maps variants including colorHex from the aliased metafield', () => {
    const product = normalizeProduct(rawProduct)
    expect(product.variants).toHaveLength(12)
    expect(product.variants[0]).toEqual({
      id: 'gid://shopify/ProductVariant/45123456789001',
      title: 'S / Black',
      sku: 'HOF-CH-BLK-S',
      availableForSale: false,
      quantityAvailable: 0,
      price: money('88.0'),
      compareAtPrice: money('110.0'),
      selectedOptions: [
        { name: 'Size', value: 'S' },
        { name: 'Color', value: 'Black' },
      ],
      image: {
        url: expect.stringContaining('core-hoodie-black-front.jpg'),
        altText: 'Core Hoodie in Black, front',
        width: 1600,
        height: 2000,
      },
      colorHex: '#1a1a1a',
    })
    expect(product.variants[1].compareAtPrice).toBeNull()
    expect(product.variants[1].colorHex).toBe('#8c7b6b')
  })

  it('falls back to the variant colorHex for a colour value with no option swatch', () => {
    expect(normalizeProduct(rawProduct).swatches).toEqual([
      { name: 'Black', color: '#1a1a1a' },
      { name: 'Taupe', color: '#8c7b6b' },
      { name: 'Bone', color: '#e8e2d9' },
    ])
  })

  it('keeps materials and careGuide as the raw metafield value strings', () => {
    const product = normalizeProduct(rawProduct)
    expect(product.materials).toBe(rawProduct.materials?.value)
    expect(JSON.parse(product.materials as string)).toMatchObject({ type: 'root' })
    expect(product.careGuide).toContain('Machine wash cold')
    expect(normalizeProduct({ ...rawProduct, materials: null, careGuide: null }).materials).toBeNull()
    expect(normalizeProduct({ ...rawProduct, materials: null, careGuide: null }).careGuide).toBeNull()
  })

  it('carries the descriptive fields through', () => {
    expect(normalizeProduct(rawProduct)).toMatchObject({
      descriptionHtml: expect.stringContaining('400gsm'),
      vendor: 'Head Over Feels',
      productType: 'Hoodies',
      tags: ['hoodies', 'new-arrival'],
      seo: {
        title: 'Core Hoodie — Head Over Feels',
        description: 'Heavyweight 400gsm fleece hoodie in Black, Taupe and Bone.',
      },
    })
  })

  it('returns a null drop when the product is not tagged drop', () => {
    expect(normalizeProduct(rawProduct).drop).toBeNull()
  })

  it('returns the drop window and max per order when the drop tag is present', () => {
    const dropRaw: RawProductDetail = {
      ...rawProduct,
      tags: ['drop', 'new-arrival'],
      dropStart: { value: '2026-09-12T17:00:00Z' },
      dropEnd: { value: '2026-09-19T17:00:00Z' },
      maxPerOrder: { value: '2' },
    }
    expect(normalizeProduct(dropRaw).drop).toEqual({
      start: '2026-09-12T17:00:00Z',
      end: '2026-09-19T17:00:00Z',
      maxPerOrder: 2,
    })
    expect(normalizeProduct(dropRaw).badges).toContain('drop')
  })

  it('tolerates a drop with missing metafields', () => {
    const dropRaw: RawProductDetail = { ...rawProduct, tags: ['drop'] }
    expect(normalizeProduct(dropRaw).drop).toEqual({ start: null, end: null, maxPerOrder: null })
  })

  it('adds the sale badge when any variant compare-at price is higher than its price', () => {
    // The card-level compareAtPriceRange is 0.0 (only some variants are on sale),
    // so the badge has to come from the variant scan.
    const product = normalizeProduct(rawProduct)
    expect(product.compareAtPrice).toBeNull()
    expect(product.badges).toEqual(['sale', 'new'])
  })

  it('adds the soldout badge when the product is unavailable', () => {
    const soldOut = normalizeProduct({ ...rawProduct, availableForSale: false, tags: [] })
    expect(soldOut.badges).toEqual(['sale', 'soldout'])
  })
})

describe('getProduct', () => {
  it('fetches with the handle variable and a product cache tag', async () => {
    mocked().mockResolvedValue({ product: rawProduct })

    const product = await getProduct('core-hoodie')

    expect(mocked()).toHaveBeenCalledTimes(1)
    const [query, opts] = mocked().mock.calls[0]
    expect(query).toBe(PRODUCT_BY_HANDLE_QUERY)
    expect(opts).toMatchObject({
      variables: { handle: 'core-hoodie' },
      tags: ['product:core-hoodie'],
      revalidate: 300,
    })
    expect(product?.handle).toBe('core-hoodie')
  })

  it('returns null when the product does not exist', async () => {
    mocked().mockResolvedValue({ product: null })
    await expect(getProduct('nope')).resolves.toBeNull()
    expect(mocked().mock.calls[0][1]).toMatchObject({ tags: ['product:nope'] })
  })
})
