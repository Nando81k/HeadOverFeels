// tests/unit/shopify/filters.test.ts
import { describe, expect, it } from 'vitest'

import {
  activeToProductFilter,
  clearFilterParams,
  filterValueToActive,
  isFilterValueActive,
  parseFilterParams,
  productFilterToActive,
  toggleFilterParam,
  type ActiveFilter,
  type ProductFilter,
} from '@/lib/shopify/filters'
import type { FilterValue } from '@/lib/shopify/types'

function filterValue(input: string): FilterValue {
  return { id: 'filter.v.option.size.m', label: 'M', count: 3, input }
}

/**
 * One row per `ProductFilter` kind: the URL pair, the Shopify `ProductFilter`
 * object and the real `FilterValue.input` string the Storefront API returns.
 */
const CASES: {
  name: string
  key: string
  value: string
  filter: ProductFilter
  input: string
}[] = [
  {
    name: 'availability (in stock)',
    key: 'filter.v.availability',
    value: '1',
    filter: { available: true },
    input: '{"available":true}',
  },
  {
    name: 'availability (out of stock)',
    key: 'filter.v.availability',
    value: '0',
    filter: { available: false },
    input: '{"available":false}',
  },
  {
    name: 'variant option',
    key: 'filter.v.option.Size',
    value: 'M',
    filter: { variantOption: { name: 'Size', value: 'M' } },
    input: '{"variantOption":{"name":"Size","value":"M"}}',
  },
  {
    name: 'price range',
    key: 'filter.v.price',
    value: '10-50',
    filter: { price: { min: 10, max: 50 } },
    input: '{"price":{"min":10,"max":50}}',
  },
  {
    name: 'product type',
    key: 'filter.p.product_type',
    value: 'Hoodies',
    filter: { productType: 'Hoodies' },
    input: '{"productType":"Hoodies"}',
  },
  {
    name: 'vendor',
    key: 'filter.p.vendor',
    value: 'Head Over Feels',
    filter: { productVendor: 'Head Over Feels' },
    input: '{"productVendor":"Head Over Feels"}',
  },
  {
    name: 'tag',
    key: 'filter.p.tag',
    value: 'drop',
    filter: { tag: 'drop' },
    input: '{"tag":"drop"}',
  },
  {
    name: 'product metafield',
    key: 'filter.p.m.custom.featured',
    value: 'true',
    filter: { productMetafield: { namespace: 'custom', key: 'featured', value: 'true' } },
    input: '{"productMetafield":{"namespace":"custom","key":"featured","value":"true"}}',
  },
  {
    name: 'variant metafield',
    key: 'filter.v.m.custom.fabric',
    value: 'fleece',
    filter: { variantMetafield: { namespace: 'custom', key: 'fabric', value: 'fleece' } },
    input: '{"variantMetafield":{"namespace":"custom","key":"fabric","value":"fleece"}}',
  },
]

describe('filter param round-trips', () => {
  for (const testCase of CASES) {
    describe(testCase.name, () => {
      const active: ActiveFilter = { key: testCase.key, value: testCase.value }

      it('parses the URL pair into a ProductFilter and an ActiveFilter', () => {
        const params = new URLSearchParams([[testCase.key, testCase.value]])

        expect(parseFilterParams(params)).toEqual({
          productFilters: [testCase.filter],
          active: [active],
        })
      })

      it('maps ActiveFilter → ProductFilter → ActiveFilter', () => {
        expect(activeToProductFilter(active)).toEqual(testCase.filter)
        expect(productFilterToActive(testCase.filter)).toEqual(active)
      })

      it('maps the Shopify FilterValue.input to the same ActiveFilter', () => {
        expect(filterValueToActive(filterValue(testCase.input))).toEqual(active)
      })

      it('reports the FilterValue as active only when the pair is in the URL', () => {
        expect(isFilterValueActive([active], filterValue(testCase.input))).toBe(true)
        expect(isFilterValueActive([], filterValue(testCase.input))).toBe(false)
        expect(
          isFilterValueActive(
            [{ key: testCase.key, value: `${testCase.value}-other` }],
            filterValue(testCase.input)
          )
        ).toBe(false)
      })
    })
  }
})

describe('parseFilterParams', () => {
  it('keeps every value of a repeatable key, in URL order', () => {
    const params = new URLSearchParams([
      ['filter.v.option.Size', 'M'],
      ['sort', 'newest'],
      ['filter.v.option.Size', 'L'],
      ['filter.v.option.Color', 'Bone'],
    ])

    expect(parseFilterParams(params)).toEqual({
      productFilters: [
        { variantOption: { name: 'Size', value: 'M' } },
        { variantOption: { name: 'Size', value: 'L' } },
        { variantOption: { name: 'Color', value: 'Bone' } },
      ],
      active: [
        { key: 'filter.v.option.Size', value: 'M' },
        { key: 'filter.v.option.Size', value: 'L' },
        { key: 'filter.v.option.Color', value: 'Bone' },
      ],
    })
  })

  it('accepts a Next searchParams record with string, array and undefined values', () => {
    expect(
      parseFilterParams({
        'filter.v.option.Size': ['M', 'L'],
        'filter.p.tag': 'drop',
        after: 'cursor',
        sort: undefined,
      })
    ).toEqual({
      productFilters: [
        { variantOption: { name: 'Size', value: 'M' } },
        { variantOption: { name: 'Size', value: 'L' } },
        { tag: 'drop' },
      ],
      active: [
        { key: 'filter.v.option.Size', value: 'M' },
        { key: 'filter.v.option.Size', value: 'L' },
        { key: 'filter.p.tag', value: 'drop' },
      ],
    })
  })

  it('parses open-ended price ranges', () => {
    expect(parseFilterParams(new URLSearchParams([['filter.v.price', '10-']])).productFilters).toEqual([
      { price: { min: 10 } },
    ])
    expect(parseFilterParams(new URLSearchParams([['filter.v.price', '-50']])).productFilters).toEqual([
      { price: { max: 50 } },
    ])
    expect(productFilterToActive({ price: { min: 10 } })).toEqual({
      key: 'filter.v.price',
      value: '10-',
    })
    expect(productFilterToActive({ price: { max: 50 } })).toEqual({
      key: 'filter.v.price',
      value: '-50',
    })
  })

  it('ignores non-filter params', () => {
    const params = new URLSearchParams([
      ['sort', 'newest'],
      ['q', 'hoodie'],
      ['after', 'cursor'],
    ])

    expect(parseFilterParams(params)).toEqual({ productFilters: [], active: [] })
  })

  it('ignores unknown and malformed filter params', () => {
    const params = new URLSearchParams([
      ['filter.v.availability', 'yes'],
      ['filter.v.price', 'abc-50'],
      ['filter.v.price', '-'],
      ['filter.v.price', '50'],
      ['filter.v.option.', 'M'],
      ['filter.v.option.Size', ''],
      ['filter.p.m.custom', 'true'],
      ['filter.p.m.custom.featured.extra', 'true'],
      ['filter.p.unknown', 'x'],
      ['filter.', 'x'],
    ])

    expect(parseFilterParams(params)).toEqual({ productFilters: [], active: [] })
  })

  it('de-duplicates an identical pair repeated in the URL', () => {
    const params = new URLSearchParams([
      ['filter.p.tag', 'drop'],
      ['filter.p.tag', 'drop'],
    ])

    expect(parseFilterParams(params).active).toEqual([{ key: 'filter.p.tag', value: 'drop' }])
  })
})

describe('filterValueToActive', () => {
  it('returns null for invalid JSON, an unknown shape or an empty input', () => {
    expect(filterValueToActive(filterValue('not json'))).toBeNull()
    expect(filterValueToActive(filterValue('{"nope":1}'))).toBeNull()
    expect(filterValueToActive(filterValue(''))).toBeNull()
    expect(filterValueToActive(filterValue('[1,2]'))).toBeNull()
  })

  it('keeps the option name casing Shopify uses in the input', () => {
    expect(
      filterValueToActive(filterValue('{"variantOption":{"name":"size","value":"m"}}'))
    ).toEqual({ key: 'filter.v.option.size', value: 'm' })
  })
})

describe('toggleFilterParam', () => {
  it('adds a missing pair, drops `after` and keeps unrelated params', () => {
    const params = new URLSearchParams([
      ['q', 'hoodie'],
      ['sort', 'newest'],
      ['after', 'cursor-1'],
    ])

    const next = toggleFilterParam(params, { key: 'filter.v.option.Size', value: 'M' })

    expect(next).not.toBe(params)
    expect(next.toString()).toBe('q=hoodie&sort=newest&filter.v.option.Size=M')
    // input untouched
    expect(params.getAll('after')).toEqual(['cursor-1'])
  })

  it('appends a second value for a repeatable key', () => {
    const params = new URLSearchParams([['filter.v.option.Size', 'M']])

    const next = toggleFilterParam(params, { key: 'filter.v.option.Size', value: 'L' })

    expect(next.getAll('filter.v.option.Size')).toEqual(['M', 'L'])
  })

  it('removes only the toggled pair and drops `after`', () => {
    const params = new URLSearchParams([
      ['filter.v.option.Size', 'M'],
      ['filter.v.option.Size', 'L'],
      ['filter.p.tag', 'drop'],
      ['after', 'cursor-1'],
      ['sort', 'newest'],
    ])

    const next = toggleFilterParam(params, { key: 'filter.v.option.Size', value: 'M' })

    expect(next.getAll('filter.v.option.Size')).toEqual(['L'])
    expect(next.get('filter.p.tag')).toBe('drop')
    expect(next.get('sort')).toBe('newest')
    expect(next.has('after')).toBe(false)
  })

  it('replaces the value of a single-valued key instead of stacking it', () => {
    const params = new URLSearchParams([
      ['filter.v.price', '10-50'],
      ['filter.v.availability', '1'],
    ])

    const next = toggleFilterParam(params, { key: 'filter.v.price', value: '0-25' })

    expect(next.getAll('filter.v.price')).toEqual(['0-25'])
    expect(next.get('filter.v.availability')).toBe('1')

    const off = toggleFilterParam(next, { key: 'filter.v.availability', value: '1' })
    expect(off.has('filter.v.availability')).toBe(false)
  })
})

describe('clearFilterParams', () => {
  it('removes every filter param and `after`, keeping the rest in order', () => {
    const params = new URLSearchParams([
      ['q', 'hoodie'],
      ['filter.v.option.Size', 'M'],
      ['sort', 'newest'],
      ['filter.p.tag', 'drop'],
      ['after', 'cursor-1'],
      ['filter.v.price', '10-50'],
    ])

    const next = clearFilterParams(params)

    expect(next).not.toBe(params)
    expect(next.toString()).toBe('q=hoodie&sort=newest')
    expect(params.getAll('filter.v.option.Size')).toEqual(['M'])
  })

  it('is a no-op for params without filters', () => {
    expect(clearFilterParams(new URLSearchParams([['sort', 'newest']])).toString()).toBe(
      'sort=newest'
    )
  })
})

describe('activeToProductFilter', () => {
  it('returns null for an unknown key', () => {
    expect(activeToProductFilter({ key: 'sort', value: 'newest' })).toBeNull()
    expect(activeToProductFilter({ key: 'filter.v.m.custom', value: 'x' })).toBeNull()
  })
})

describe('productFilterToActive', () => {
  it('returns null for an empty price range and an unknown shape', () => {
    expect(productFilterToActive({ price: {} })).toBeNull()
    expect(productFilterToActive({ tag: '' } as ProductFilter)).toBeNull()
  })
})
