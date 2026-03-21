import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { productCarouselSpy } = vi.hoisted(() => ({
  productCarouselSpy: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: ReactNode
    [key: string]: unknown
  }) => <a href={href} {...props}>{children}</a>,
}))

vi.mock('@/components/recommendations/ProductCarousel', () => ({
  ProductCarousel: (props: {
    products: unknown[]
    title: string
    subtitle?: string
    sourceProductId?: string
    trackingType?: string
  }) => {
    productCarouselSpy(props)
    return (
      <div data-testid="recommendation-carousel-mock">
        {props.title} ({props.products.length})
      </div>
    )
  },
}))

import { SimilarProducts } from '@/components/recommendations/SimilarProducts'

const createRecommendation = (id: string) => ({
  id,
  name: `Product ${id}`,
  slug: `product-${id}`,
  price: 59,
  compareAtPrice: 79,
  images: JSON.stringify(['/hoodie.jpg']),
  category: { id: 'cat-1', name: 'Hoodies' },
  variants: [{ id: `variant-${id}`, size: 'M', color: 'Black', inventory: 4 }],
  recommendationScore: 0.91,
  recommendationReason: 'Similar style and category',
})

describe('SimilarProducts', () => {
  beforeEach(() => {
    productCarouselSpy.mockReset()
  })

  it('fetches recommendations with limit and renders the upgraded carousel', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          recommendations: [createRecommendation('one'), createRecommendation('two')],
        },
      }),
    })) as unknown as typeof fetch

    render(<SimilarProducts productId="prod-101" limit={4} />)

    expect(screen.getByTestId('similar-products-loading')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByTestId('recommendation-carousel-mock')).toBeTruthy()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/recommendations/similar/prod-101?limit=4',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )

    const latestCall = productCarouselSpy.mock.calls[productCarouselSpy.mock.calls.length - 1]?.[0]
    expect(latestCall).toMatchObject({
      title: 'You May Also Like',
      sourceProductId: 'prod-101',
      trackingType: 'similar',
      subtitle: 'Recommended from similar style, category, and shopper behavior.',
    })
  })

  it('renders empty state when no recommendations are returned', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          recommendations: [],
        },
      }),
    })) as unknown as typeof fetch

    render(<SimilarProducts productId="prod-empty" />)

    await waitFor(() => {
      expect(screen.getByTestId('similar-products-empty')).toBeTruthy()
    })

    expect(screen.getByText('No recommendations yet for this product.')).toBeTruthy()
    expect(screen.getByRole('link', { name: /explore all products/i }).getAttribute('href')).toBe('/products')
  })

  it('shows error state and retries fetch on demand', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            recommendations: [createRecommendation('retry')],
          },
        }),
      })

    global.fetch = fetchMock as unknown as typeof fetch

    render(<SimilarProducts productId="prod-retry" />)

    await waitFor(() => {
      expect(screen.getByTestId('similar-products-error')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() => {
      expect(screen.getByTestId('recommendation-carousel-mock')).toBeTruthy()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
