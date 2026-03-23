import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSmartDiscoveryProducts } from '@/lib/commerce/smart-discovery'

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}))

function makeProduct(id: string) {
  return {
    id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    price: 50,
    images: '[]',
    isActive: true,
    isFeatured: true,
    variants: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('fetchSmartDiscoveryProducts', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('uses featured first and excludes provided product ids', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [makeProduct('p-1'), makeProduct('p-2'), makeProduct('p-3')],
      }),
    } as Response)

    const result = await fetchSmartDiscoveryProducts(['p-2'], 2)
    expect(result.map((product) => product.id)).toEqual(['p-1', 'p-3'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to newest active products when featured is sparse', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [makeProduct('p-1')],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [makeProduct('p-2'), makeProduct('p-3')],
        }),
      } as Response)

    const result = await fetchSmartDiscoveryProducts([], 3)
    expect(result.map((product) => product.id)).toEqual(['p-1', 'p-2', 'p-3'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
