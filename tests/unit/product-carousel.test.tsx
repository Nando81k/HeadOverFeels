import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductCarousel, ProductRecommendation } from '@/components/recommendations/ProductCarousel'

const { productCardSpy } = vi.hoisted(() => ({
  productCardSpy: vi.fn(),
}))

vi.mock('@/components/recommendations/ProductCard', () => ({
  ProductCard: (props: { product: ProductRecommendation }) => {
    productCardSpy(props)
    return <div data-testid="recommendation-card">{props.product.name}</div>
  },
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

const baseProducts: ProductRecommendation[] = [
  {
    id: 'rec-1',
    name: 'Midnight Hoodie',
    slug: 'midnight-hoodie',
    price: 88,
    images: JSON.stringify(['/img-1.jpg']),
    category: { id: 'c1', name: 'Hoodies' },
    recommendationScore: 0.92,
    recommendationReason: 'Similar style and category',
    variants: [{ id: 'v1', size: 'M', color: 'Black', inventory: 5 }],
  },
  {
    id: 'rec-2',
    name: 'Cream Hoodie',
    slug: 'cream-hoodie',
    price: 84,
    images: JSON.stringify(['/img-2.jpg']),
    category: { id: 'c1', name: 'Hoodies' },
    recommendationScore: 0.87,
    recommendationReason: 'Customers also bought this',
    variants: [{ id: 'v2', size: 'L', color: 'Cream', inventory: 2 }],
  },
]

describe('ProductCarousel', () => {
  beforeEach(() => {
    productCardSpy.mockReset()
    global.fetch = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      configurable: true,
      value: vi.fn(),
      writable: true,
    })
  })

  it('renders modern header, cards, and tracks batch impressions', async () => {
    render(
      <ProductCarousel
        products={baseProducts}
        title="You May Also Like"
        subtitle="Recommended from similar style, category, and shopper behavior."
        sourceProductId="source-prod-1"
        trackingType="similar"
      />
    )

    expect(screen.getByText('You May Also Like')).toBeTruthy()
    expect(screen.getByText('Personalized Picks')).toBeTruthy()
    expect(screen.getByText('Recommended from similar style, category, and shopper behavior.')).toBeTruthy()
    expect(screen.getAllByTestId('recommendation-card')).toHaveLength(2)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/recommendations/track',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('batch_impression'),
        })
      )
    })

    const fetchCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(fetchCall?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const payload = JSON.parse((fetchCall?.[1] as { body: string }).body)
    expect(payload).toMatchObject({
      event: 'batch_impression',
      sourceProductId: 'source-prod-1',
      type: 'SIMILAR',
      targetProductIds: ['rec-1', 'rec-2'],
    })
  })

  it('supports keyboard carousel navigation', () => {
    render(
      <ProductCarousel
        products={baseProducts}
        title="You May Also Like"
      />
    )

    const carousel = screen.getByTestId('recommendation-carousel')
    fireEvent.keyDown(carousel, { key: 'ArrowRight' })

    expect((HTMLElement.prototype.scrollBy as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
  })
})
