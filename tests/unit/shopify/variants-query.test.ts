// tests/unit/shopify/variants-query.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

import { storefrontFetch } from '@/lib/shopify/client'
import {
  getVariantsByIds,
  isRawVariantNode,
  normalizeVariantNodes,
  toProductCardVariant,
  VARIANTS_BY_ID_QUERY,
  VARIANTS_CHUNK_SIZE,
  VARIANTS_REVALIDATE,
  type RawVariantNode,
  type RawVariantsResponse,
} from '@/lib/shopify/queries/variants'
import variantsFixture from '@/tests/fixtures/shopify/variants.json'

const fixture = variantsFixture as unknown as RawVariantsResponse
const rawNodes = fixture.nodes ?? []
const [hoodie, crew, tee, cap] = rawNodes as RawVariantNode[]
const mocked = () => vi.mocked(storefrontFetch)

beforeEach(() => {
  mocked().mockReset()
})

describe('VARIANTS_BY_ID_QUERY', () => {
  it('is the validated nodes(ids:) document', () => {
    expect(VARIANTS_BY_ID_QUERY).toContain('query VariantsById($ids: [ID!]!)')
    expect(VARIANTS_BY_ID_QUERY).toContain('nodes(ids: $ids)')
    expect(VARIANTS_BY_ID_QUERY).toContain('... on ProductVariant')
    expect(VARIANTS_BY_ID_QUERY).toContain('quantityAvailable')
    expect(VARIANTS_BY_ID_QUERY).toContain('compareAtPrice { amount currencyCode }')
    expect(VARIANTS_BY_ID_QUERY).toContain('selectedOptions { name value }')
    expect(VARIANTS_BY_ID_QUERY).toContain('image { url altText width height }')
    expect(VARIANTS_BY_ID_QUERY).toContain(
      'product { id handle title tags availableForSale featuredImage { url altText width height } }'
    )
    // No shared fragments are spread, so none may be appended.
    expect(VARIANTS_BY_ID_QUERY).not.toContain('fragment ')
  })

  it('exposes the agreed cache settings', () => {
    expect(VARIANTS_CHUNK_SIZE).toBe(50)
    expect(VARIANTS_REVALIDATE).toBe(60)
  })
})

describe('isRawVariantNode', () => {
  it('accepts a ProductVariant node', () => {
    expect(isRawVariantNode(hoodie)).toBe(true)
  })

  it('rejects null and non-variant nodes', () => {
    expect(isRawVariantNode(null)).toBe(false)
    // A `nodes(ids:)` entry of another type resolves the inline fragment to `{}`.
    expect(isRawVariantNode({})).toBe(false)
    expect(isRawVariantNode({ id: 'gid://shopify/Product/1' })).toBe(false)
    expect(isRawVariantNode({ id: 'gid://shopify/ProductVariant/1', product: null })).toBe(false)
  })
})

describe('toProductCardVariant', () => {
  it('normalises a variant with its product summary', () => {
    expect(toProductCardVariant(hoodie)).toEqual({
      id: 'gid://shopify/ProductVariant/45123456789005',
      title: 'M / Taupe',
      availableForSale: true,
      quantityAvailable: 12,
      price: { amount: '88.0', currencyCode: 'USD' },
      compareAtPrice: null,
      selectedOptions: [
        { name: 'Size', value: 'M' },
        { name: 'Color', value: 'Taupe' },
      ],
      image: {
        url: 'https://cdn.shopify.com/s/files/1/0001/0001/0001/files/core-hoodie-taupe-front.jpg',
        altText: 'Core Hoodie in Taupe, front',
        width: 1600,
        height: 2000,
      },
      product: {
        id: 'gid://shopify/Product/8123456789001',
        handle: 'core-hoodie',
        title: 'Core Hoodie',
        tags: ['hoodies', 'new-arrival'],
        availableForSale: true,
        featuredImage: {
          url: 'https://cdn.shopify.com/s/files/1/0001/0001/0001/files/core-hoodie-black-front.jpg',
          altText: 'Core Hoodie in Black, front',
          width: 1600,
          height: 2000,
        },
      },
    })
  })

  it('keeps compareAtPrice when the variant is on sale', () => {
    const result = toProductCardVariant(crew)
    expect(result.price).toEqual({ amount: '64.0', currencyCode: 'USD' })
    expect(result.compareAtPrice).toEqual({ amount: '84.0', currencyCode: 'USD' })
    expect(result.product.handle).toBe('boxy-crew')
  })

  it('drops a compareAtPrice that is not higher than the price', () => {
    const result = toProductCardVariant({
      ...hoodie,
      compareAtPrice: { amount: '88.0', currencyCode: 'USD' },
    })
    expect(result.compareAtPrice).toBeNull()
  })

  it('normalises null quantityAvailable / altText and passes product tags through', () => {
    const result = toProductCardVariant(tee)
    expect(result.quantityAvailable).toBeNull()
    expect(result.image?.altText).toBeNull()
    expect(result.product.tags).toEqual(['tees', 'drop'])
  })

  it('keeps a sold-out variant with a null image and the product featured image', () => {
    const result = toProductCardVariant(cap)
    expect(result.availableForSale).toBe(false)
    expect(result.quantityAvailable).toBe(0)
    expect(result.image).toBeNull()
    expect(result.product.availableForSale).toBe(false)
    expect(result.product.featuredImage?.url).toContain('hof-cap-front.jpg')
    expect(result.selectedOptions).toEqual([{ name: 'Size', value: 'One Size' }])
  })
})

describe('normalizeVariantNodes', () => {
  it('drops null and non-variant nodes and keeps response order', () => {
    const result = normalizeVariantNodes([...rawNodes, {}, { id: 'gid://shopify/Product/9' }])
    expect(result.map((v) => v.id)).toEqual([
      'gid://shopify/ProductVariant/45123456789005',
      'gid://shopify/ProductVariant/45123456789205',
      'gid://shopify/ProductVariant/45123456789301',
      'gid://shopify/ProductVariant/45123456789401',
    ])
  })

  it('returns an empty array for a null or empty list', () => {
    expect(normalizeVariantNodes(null)).toEqual([])
    expect(normalizeVariantNodes([])).toEqual([])
  })
})

describe('getVariantsByIds', () => {
  it('returns [] without fetching when given no ids', async () => {
    await expect(getVariantsByIds([])).resolves.toEqual([])
    expect(mocked()).not.toHaveBeenCalled()
  })

  it('fetches one chunk with the variants tag and a 60s revalidate', async () => {
    mocked().mockResolvedValueOnce(fixture)
    const ids = rawNodes.filter(isRawVariantNode).map((node) => node.id)

    const result = await getVariantsByIds(ids)

    expect(mocked()).toHaveBeenCalledTimes(1)
    expect(mocked()).toHaveBeenCalledWith(VARIANTS_BY_ID_QUERY, {
      variables: { ids },
      tags: ['variants'],
      revalidate: 60,
    })
    expect(result).toHaveLength(4)
    expect(result.map((v) => v.product.handle)).toEqual([
      'core-hoodie',
      'boxy-crew',
      'mind-over-matter-tee',
      'hof-cap',
    ])
  })

  it('drops null nodes (deleted variants) from the result', async () => {
    mocked().mockResolvedValueOnce(fixture)
    const result = await getVariantsByIds([
      ...rawNodes.filter(isRawVariantNode).map((node) => node.id),
      'gid://shopify/ProductVariant/0',
    ])
    expect(result.map((v) => v.id)).not.toContain('gid://shopify/ProductVariant/0')
    expect(result).toHaveLength(4)
  })

  it('returns variants in input order even when Shopify answers out of order', async () => {
    mocked().mockResolvedValueOnce({ nodes: [cap, hoodie, null, tee, crew] })
    const result = await getVariantsByIds([hoodie.id, crew.id, tee.id, cap.id])
    expect(result.map((v) => v.id)).toEqual([hoodie.id, crew.id, tee.id, cap.id])
  })

  it('de-duplicates repeated ids', async () => {
    mocked().mockResolvedValueOnce({ nodes: [hoodie] })
    const result = await getVariantsByIds([hoodie.id, hoodie.id])
    expect(mocked()).toHaveBeenCalledTimes(1)
    expect(mocked().mock.calls[0][1]).toMatchObject({ variables: { ids: [hoodie.id] } })
    expect(result.map((v) => v.id)).toEqual([hoodie.id])
  })

  it('chunks requests at 50 ids and concatenates the chunks in input order', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `gid://shopify/ProductVariant/${1000 + i}`)
    mocked().mockImplementation(async (_query, opts) => {
      const requested = (opts?.variables as { ids: string[] }).ids
      return { nodes: requested.map((id) => ({ ...hoodie, id })) }
    })

    const result = await getVariantsByIds(ids)

    expect(mocked()).toHaveBeenCalledTimes(3)
    const sizes = mocked().mock.calls.map(
      (call) => (call[1]?.variables as { ids: string[] }).ids.length
    )
    expect(sizes).toEqual([50, 50, 20])
    expect(result.map((v) => v.id)).toEqual(ids)
  })
})
