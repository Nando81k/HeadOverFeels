// tests/unit/scripts/shopify-build-product-set-input.test.ts
import { describe, it, expect } from 'vitest'

import {
  buildProductSetInput,
  toRichTextJson,
  type MigrationProduct,
  type MigrationVariant,
} from '@/scripts/shopify/lib/build-product-set-input'

const LOCATION_ID = 'gid://shopify/Location/1234567890'
const opts = { locationId: LOCATION_ID }

function variant(overrides: Partial<MigrationVariant> = {}): MigrationVariant {
  return {
    id: 'v1',
    sku: 'HOF-TEE-BLK-M',
    size: 'M',
    color: 'Black',
    colorHex: '#000000',
    images: null,
    price: null,
    inventory: 5,
    isActive: true,
    costPrice: null,
    ...overrides,
  }
}

function product(overrides: Partial<MigrationProduct> = {}): MigrationProduct {
  return {
    id: 'p1',
    name: 'Tokyo Nights Hoodie',
    description: 'Heavyweight fleece hoodie.',
    slug: 'tokyo-nights-hoodie',
    price: 120,
    compareAtPrice: null,
    images: JSON.stringify(['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg']),
    materials: null,
    careGuide: null,
    isLimitedEdition: false,
    releaseDate: null,
    dropEndDate: null,
    maxQuantity: null,
    isActive: true,
    isFeatured: false,
    isFeaturedNewArrival: false,
    costPrice: null,
    variants: [variant()],
    category: { name: 'Hoodies', slug: 'hoodies' },
    collections: [],
    ...overrides,
  }
}

describe('buildProductSetInput — product level', () => {
  it('maps handle, title, productType and ACTIVE status', () => {
    const input = buildProductSetInput(product(), opts)

    expect(input.handle).toBe('tokyo-nights-hoodie')
    expect(input.title).toBe('Tokyo Nights Hoodie')
    expect(input.productType).toBe('Hoodies')
    expect(input.status).toBe('ACTIVE')
  })

  it('marks inactive products DRAFT and falls back to an empty productType', () => {
    const input = buildProductSetInput(product({ isActive: false, category: null }), opts)

    expect(input.status).toBe('DRAFT')
    expect(input.productType).toBe('')
  })

  it('wraps a plain-text description in <p> but leaves existing markup alone', () => {
    expect(buildProductSetInput(product(), opts).descriptionHtml).toBe(
      '<p>Heavyweight fleece hoodie.</p>'
    )
    expect(
      buildProductSetInput(product({ description: '<p>Already <b>rich</b></p>' }), opts)
        .descriptionHtml
    ).toBe('<p>Already <b>rich</b></p>')
    expect(buildProductSetInput(product({ description: null }), opts).descriptionHtml).toBe('')
  })

  it('derives tags from the drop / featured / new-arrival flags', () => {
    expect(buildProductSetInput(product(), opts).tags).toEqual([])
    expect(
      buildProductSetInput(
        product({ isLimitedEdition: true, isFeatured: true, isFeaturedNewArrival: true }),
        opts
      ).tags
    ).toEqual(['drop', 'featured', 'new-arrival'])
  })

  it('builds deduped product files from the images JSON, including variant images', () => {
    const input = buildProductSetInput(
      product({
        images: JSON.stringify([
          'https://cdn.example.com/a.jpg',
          'https://cdn.example.com/a.jpg',
          'https://cdn.example.com/b.jpg',
        ]),
        variants: [
          variant({ images: JSON.stringify(['https://cdn.example.com/b.jpg']) }),
          variant({
            id: 'v2',
            sku: 'HOF-TEE-WHT-M',
            color: 'White',
            colorHex: '#ffffff',
            images: JSON.stringify(['https://cdn.example.com/c.jpg']),
          }),
        ],
      }),
      opts
    )

    expect(input.files).toEqual([
      { originalSource: 'https://cdn.example.com/a.jpg', contentType: 'IMAGE' },
      { originalSource: 'https://cdn.example.com/b.jpg', contentType: 'IMAGE' },
      { originalSource: 'https://cdn.example.com/c.jpg', contentType: 'IMAGE' },
    ])
  })

  it('omits files when the images JSON is empty or unparseable', () => {
    expect(buildProductSetInput(product({ images: '[]' }), opts).files).toBeUndefined()
    expect(buildProductSetInput(product({ images: 'not json' }), opts).files).toBeUndefined()
  })

  it('skips site-relative placeholder images Shopify could never fetch', () => {
    const input = buildProductSetInput(
      product({
        images: JSON.stringify([
          '/assets/coming-soon-placeholder.svg',
          'https://cdn.example.com/a.jpg',
        ]),
        variants: [variant({ images: JSON.stringify(['/assets/coming-soon-placeholder.svg']) })],
      }),
      opts
    )

    expect(input.files).toEqual([
      { originalSource: 'https://cdn.example.com/a.jpg', contentType: 'IMAGE' },
    ])
    expect(input.variants[0].file).toBeUndefined()
  })
})

describe('buildProductSetInput — options and variants', () => {
  it('builds Size and Color options from distinct non-null values in first-seen order', () => {
    const input = buildProductSetInput(
      product({
        variants: [
          variant({ id: 'a', sku: 'A', size: 'M', color: 'Black' }),
          variant({ id: 'b', sku: 'B', size: 'S', color: 'Black' }),
          variant({ id: 'c', sku: 'C', size: 'M', color: 'Bone' }),
        ],
      }),
      opts
    )

    expect(input.productOptions).toEqual([
      { name: 'Size', values: [{ name: 'M' }, { name: 'S' }] },
      { name: 'Color', values: [{ name: 'Black' }, { name: 'Bone' }] },
    ])
    expect(input.variants[2].optionValues).toEqual([
      { optionName: 'Size', name: 'M' },
      { optionName: 'Color', name: 'Bone' },
    ])
  })

  it('emits a single Size option when no variant has a colour', () => {
    const input = buildProductSetInput(
      product({
        variants: [
          variant({ id: 'a', sku: 'A', size: 'M', color: null, colorHex: null }),
          variant({ id: 'b', sku: 'B', size: 'L', color: null, colorHex: null }),
        ],
      }),
      opts
    )

    expect(input.productOptions).toEqual([
      { name: 'Size', values: [{ name: 'M' }, { name: 'L' }] },
    ])
    expect(input.variants[0].optionValues).toEqual([{ optionName: 'Size', name: 'M' }])
  })

  it('emits no options and one default variant when nothing is optioned', () => {
    const input = buildProductSetInput(
      product({
        variants: [
          variant({ id: 'a', sku: 'ONLY-SKU', size: null, color: null, colorHex: null, inventory: 7 }),
          variant({ id: 'b', sku: 'IGNORED', size: null, color: null, colorHex: null }),
        ],
      }),
      opts
    )

    expect(input.productOptions).toBeUndefined()
    expect(input.variants).toHaveLength(1)
    expect(input.variants[0].optionValues).toBeUndefined()
    expect(input.variants[0].sku).toBe('ONLY-SKU')
    expect(input.variants[0].inventoryQuantities).toEqual([
      { locationId: LOCATION_ID, name: 'available', quantity: 7 },
    ])
  })

  it('synthesises a default variant when the product has none', () => {
    const input = buildProductSetInput(product({ variants: [] }), opts)

    expect(input.productOptions).toBeUndefined()
    expect(input.variants).toEqual([
      {
        price: '120.00',
        inventoryQuantities: [{ locationId: LOCATION_ID, name: 'available', quantity: 0 }],
      },
    ])
  })

  it('prices variants as 2-decimal strings, falling back to the product price', () => {
    const input = buildProductSetInput(
      product({
        price: 120,
        variants: [variant({ price: null }), variant({ id: 'b', sku: 'B', size: 'L', price: 99.5 })],
      }),
      opts
    )

    expect(input.variants[0].price).toBe('120.00')
    expect(input.variants[1].price).toBe('99.50')
  })

  it('sets compareAtPrice only when it is above the variant price', () => {
    const higher = buildProductSetInput(product({ compareAtPrice: 150 }), opts)
    expect(higher.variants[0].compareAtPrice).toBe('150.00')

    const equal = buildProductSetInput(product({ compareAtPrice: 120 }), opts)
    expect(equal.variants[0].compareAtPrice).toBeUndefined()

    const lower = buildProductSetInput(product({ compareAtPrice: 90 }), opts)
    expect(lower.variants[0].compareAtPrice).toBeUndefined()
  })

  it('sets inventory at the given location and the unit cost when a cost price exists', () => {
    const input = buildProductSetInput(
      product({
        variants: [variant({ inventory: 12, costPrice: 42.5 })],
      }),
      opts
    )

    expect(input.variants[0].inventoryQuantities).toEqual([
      { locationId: LOCATION_ID, name: 'available', quantity: 12 },
    ])
    expect(input.variants[0].inventoryItem).toEqual({ cost: '42.50', tracked: true })
  })

  it('falls back to the product cost price and omits inventoryItem when there is none', () => {
    expect(
      buildProductSetInput(product({ costPrice: 30 }), opts).variants[0].inventoryItem
    ).toEqual({ cost: '30.00', tracked: true })
    expect(buildProductSetInput(product(), opts).variants[0].inventoryItem).toBeUndefined()
  })

  it('adds the custom.color_hex metafield only for well-formed hex colours', () => {
    expect(buildProductSetInput(product(), opts).variants[0].metafields).toEqual([
      { namespace: 'custom', key: 'color_hex', type: 'color', value: '#000000' },
    ])
    expect(
      buildProductSetInput(product({ variants: [variant({ colorHex: '#FFF' })] }), opts).variants[0]
        .metafields
    ).toBeUndefined()
    expect(
      buildProductSetInput(product({ variants: [variant({ colorHex: 'black' })] }), opts)
        .variants[0].metafields
    ).toBeUndefined()
  })

  it('attaches the first variant image as the variant file', () => {
    const input = buildProductSetInput(
      product({
        variants: [
          variant({
            images: JSON.stringify([
              'https://cdn.example.com/black-1.jpg',
              'https://cdn.example.com/black-2.jpg',
            ]),
          }),
        ],
      }),
      opts
    )

    expect(input.variants[0].file).toEqual({
      originalSource: 'https://cdn.example.com/black-1.jpg',
      contentType: 'IMAGE',
    })
    expect(buildProductSetInput(product(), opts).variants[0].file).toBeUndefined()
  })
})

describe('buildProductSetInput — product metafields', () => {
  it('omits the metafields key entirely when nothing is set', () => {
    expect(buildProductSetInput(product(), opts).metafields).toBeUndefined()
  })

  it('writes materials and care_guide as rich_text JSON', () => {
    const input = buildProductSetInput(
      product({ materials: '100% cotton', careGuide: 'Cold wash' }),
      opts
    )

    expect(input.metafields).toEqual([
      {
        namespace: 'custom',
        key: 'materials',
        type: 'rich_text_field',
        value:
          '{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","value":"100% cotton"}]}]}',
      },
      {
        namespace: 'custom',
        key: 'care_guide',
        type: 'rich_text_field',
        value:
          '{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","value":"Cold wash"}]}]}',
      },
    ])
  })

  it('writes drop_start / drop_end as ISO strings and max_per_order as an integer string', () => {
    const input = buildProductSetInput(
      product({
        isLimitedEdition: true,
        releaseDate: new Date('2026-10-01T17:00:00.000Z'),
        dropEndDate: new Date('2026-10-08T17:00:00.000Z'),
        maxQuantity: 2,
      }),
      opts
    )

    expect(input.metafields).toEqual([
      {
        namespace: 'custom',
        key: 'drop_start',
        type: 'date_time',
        value: '2026-10-01T17:00:00.000Z',
      },
      {
        namespace: 'custom',
        key: 'drop_end',
        type: 'date_time',
        value: '2026-10-08T17:00:00.000Z',
      },
      { namespace: 'custom', key: 'max_per_order', type: 'number_integer', value: '2' },
    ])
  })

  it('accepts ISO date strings as well as Date instances', () => {
    const input = buildProductSetInput(
      product({ releaseDate: '2026-10-01T17:00:00.000Z' }),
      opts
    )

    expect(input.metafields).toEqual([
      {
        namespace: 'custom',
        key: 'drop_start',
        type: 'date_time',
        value: '2026-10-01T17:00:00.000Z',
      },
    ])
  })
})

describe('toRichTextJson', () => {
  it('produces the exact Shopify rich_text_field root document', () => {
    expect(toRichTextJson('Hello')).toBe(
      '{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","value":"Hello"}]}]}'
    )
  })

  it('escapes quotes and newlines through JSON.stringify', () => {
    expect(JSON.parse(toRichTextJson('He said "hi"\nbye'))).toEqual({
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: 'He said "hi"\nbye' }] },
      ],
    })
  })
})
