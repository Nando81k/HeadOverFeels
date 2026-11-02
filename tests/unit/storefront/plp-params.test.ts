// tests/unit/storefront/plp-params.test.ts
import { describe, expect, it } from 'vitest'

import {
  SEARCH_SORT_OPTIONS,
  SORT_OPTIONS,
  buildPlpHref,
  parsePlpParams,
  parseSearchParams,
  searchEntries,
  toSearchString,
  type PlpContext,
} from '@/lib/storefront/plp-params'

const PATHNAME = '/collections/all'

function ctx(search: string): PlpContext {
  return { pathname: PATHNAME, search }
}

describe('SORT_OPTIONS', () => {
  it('lists the five collection sorts in merchandising order', () => {
    expect(SORT_OPTIONS.map((option) => option.value)).toEqual([
      'best-selling',
      'newest',
      'price-asc',
      'price-desc',
      'title',
    ])
    expect(SORT_OPTIONS.map((option) => option.label)).toEqual([
      'Best selling',
      'Newest',
      'Price: low to high',
      'Price: high to low',
      'A–Z',
    ])
  })

  it('lists the three search sorts', () => {
    expect(SEARCH_SORT_OPTIONS).toEqual([
      { value: 'relevance', label: 'Relevance' },
      { value: 'price-asc', label: 'Price: low to high' },
      { value: 'price-desc', label: 'Price: high to low' },
    ])
  })
})

describe('parsePlpParams', () => {
  it('defaults to best-selling with no cursor and no filters', () => {
    expect(parsePlpParams({})).toEqual({
      sort: 'best-selling',
      after: null,
      filters: [],
      active: [],
    })
  })

  it('reads a known sort and the cursor', () => {
    const parsed = parsePlpParams({ sort: 'newest', after: 'cursor-1' })
    expect(parsed.sort).toBe('newest')
    expect(parsed.after).toBe('cursor-1')
  })

  it('falls back to the default sort for an unknown value', () => {
    expect(parsePlpParams({ sort: 'cheapest' }).sort).toBe('best-selling')
    expect(parsePlpParams({ sort: 'cheapest' }, { defaultSort: 'title' }).sort).toBe('title')
    expect(parsePlpParams({}, { defaultSort: 'title' }).sort).toBe('title')
  })

  it('maps repeated filter params through parseFilterParams', () => {
    const parsed = parsePlpParams({
      'filter.v.option.color': ['Black', 'Bone'],
      'filter.v.availability': '1',
    })

    expect(parsed.active).toEqual([
      { key: 'filter.v.option.color', value: 'Black' },
      { key: 'filter.v.option.color', value: 'Bone' },
      { key: 'filter.v.availability', value: '1' },
    ])
    expect(parsed.filters).toEqual([
      { variantOption: { name: 'color', value: 'Black' } },
      { variantOption: { name: 'color', value: 'Bone' } },
      { available: true },
    ])
  })

  it('folds the price form min/max params into a price filter', () => {
    const parsed = parsePlpParams({ min: '20', max: '50' })

    expect(parsed.active).toEqual([{ key: 'filter.v.price', value: '20-50' }])
    expect(parsed.filters).toEqual([{ price: { min: 20, max: 50 } }])
  })

  it('accepts a one-sided price range', () => {
    expect(parsePlpParams({ min: '20' }).active).toEqual([
      { key: 'filter.v.price', value: '20-' },
    ])
    expect(parsePlpParams({ max: '50' }).filters).toEqual([{ price: { max: 50 } }])
  })

  it('ignores blank or malformed price bounds', () => {
    expect(parsePlpParams({ min: '', max: '' }).active).toEqual([])
    expect(parsePlpParams({ min: 'cheap' }).active).toEqual([])
  })

  it('lets min/max replace an existing filter.v.price param', () => {
    const parsed = parsePlpParams({ 'filter.v.price': '0-10', min: '20', max: '50' })

    expect(parsed.active).toEqual([{ key: 'filter.v.price', value: '20-50' }])
    expect(parsed.filters).toEqual([{ price: { min: 20, max: 50 } }])
  })

  it('accepts URLSearchParams as well as a record', () => {
    const parsed = parsePlpParams(new URLSearchParams('sort=price-asc&filter.p.tag=drop'))
    expect(parsed.sort).toBe('price-asc')
    expect(parsed.filters).toEqual([{ tag: 'drop' }])
  })
})

describe('parseSearchParams', () => {
  it('trims the query and defaults to relevance', () => {
    const parsed = parseSearchParams({ q: '  hoodie  ' })
    expect(parsed).toEqual({ q: 'hoodie', sort: 'relevance', after: null, filters: [], active: [] })
  })

  it('reads a known search sort and rejects a collection-only sort', () => {
    expect(parseSearchParams({ q: 'x', sort: 'price-desc' }).sort).toBe('price-desc')
    expect(parseSearchParams({ q: 'x', sort: 'best-selling' }).sort).toBe('relevance')
  })

  it('reads filters, the cursor and folds min/max', () => {
    const parsed = parseSearchParams({ q: 'tee', after: 'c2', min: '10', 'filter.p.tag': 'drop' })
    expect(parsed.after).toBe('c2')
    expect(parsed.active).toEqual([
      { key: 'filter.p.tag', value: 'drop' },
      { key: 'filter.v.price', value: '10-' },
    ])
  })

  it('treats a missing query as empty', () => {
    expect(parseSearchParams({}).q).toBe('')
  })
})

describe('toSearchString', () => {
  it('returns an empty string when there is nothing to carry', () => {
    expect(toSearchString({})).toBe('')
    expect(toSearchString(new URLSearchParams())).toBe('')
  })

  it('keeps insertion order and repeats array values', () => {
    expect(toSearchString({ q: 'hoodie', sort: 'newest' })).toBe('?q=hoodie&sort=newest')
    expect(toSearchString({ 'filter.v.option.color': ['Black', 'Bone'] })).toBe(
      '?filter.v.option.color=Black&filter.v.option.color=Bone'
    )
  })

  it('round-trips a URLSearchParams instance', () => {
    expect(toSearchString(new URLSearchParams('a=b&a=c'))).toBe('?a=b&a=c')
  })
})

describe('searchEntries', () => {
  it('splits a query string with or without its leading question mark', () => {
    expect(searchEntries('?a=b&c=d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
    expect(searchEntries('a=b')).toEqual([['a', 'b']])
    expect(searchEntries('')).toEqual([])
  })
})

describe('buildPlpHref', () => {
  it('sets the sort and drops the cursor', () => {
    expect(buildPlpHref(ctx('?sort=newest&after=abc'), { sort: 'title' })).toBe(
      '/collections/all?sort=title'
    )
  })

  it('removes the sort param when passed null', () => {
    expect(buildPlpHref(ctx('?sort=newest'), { sort: null })).toBe('/collections/all')
  })

  it('toggles a filter on and back off', () => {
    const on = buildPlpHref(ctx(''), {
      toggle: { key: 'filter.v.option.color', value: 'Black' },
    })
    expect(on).toBe('/collections/all?filter.v.option.color=Black')

    const off = buildPlpHref(ctx('?filter.v.option.color=Black'), {
      toggle: { key: 'filter.v.option.color', value: 'Black' },
    })
    expect(off).toBe('/collections/all')
  })

  it('clears every filter but keeps q and sort', () => {
    const href = buildPlpHref(ctx('?q=tee&sort=newest&filter.p.tag=drop&after=abc'), {
      clear: true,
    })
    expect(href).toBe('/collections/all?q=tee&sort=newest')
  })

  it('always preserves q and always drops after', () => {
    expect(
      buildPlpHref(ctx('?q=tee&after=abc'), {
        toggle: { key: 'filter.p.tag', value: 'drop' },
      })
    ).toBe('/collections/all?q=tee&filter.p.tag=drop')
  })

  it('replaces the price filter and clears the raw min/max params', () => {
    const href = buildPlpHref(ctx('?min=1&max=2&sort=newest'), {
      price: { min: '20', max: '50' },
    })
    expect(href).toBe('/collections/all?sort=newest&filter.v.price=20-50')
  })

  it('removes the price filter when passed null or an empty range', () => {
    expect(buildPlpHref(ctx('?filter.v.price=20-50&q=tee'), { price: null })).toBe(
      '/collections/all?q=tee'
    )
    expect(buildPlpHref(ctx('?filter.v.price=20-50'), { price: { min: '', max: '' } })).toBe(
      '/collections/all'
    )
  })

  it('folds pre-existing min/max params into the price filter on any patch', () => {
    expect(buildPlpHref(ctx('?min=20&max=50'), { sort: 'newest' })).toBe(
      '/collections/all?filter.v.price=20-50&sort=newest'
    )
  })

  it('returns the bare pathname when nothing is left', () => {
    expect(buildPlpHref(ctx('?after=abc'), {})).toBe('/collections/all')
  })
})
