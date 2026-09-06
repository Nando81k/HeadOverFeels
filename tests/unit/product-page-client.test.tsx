/* eslint-disable @next/next/no-img-element */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReactNode } from 'react'
import ProductPageClient from '@/app/products/[slug]/ProductPageClient'
import { Product } from '@/lib/api/products'

const { addItemMock, pushMock } = vi.hoisted(() => ({
  addItemMock: vi.fn(),
  pushMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('next/image', () => ({
  default: (props: {
    src: string | { src: string }
    alt: string
    fill?: boolean
    priority?: boolean
    [key: string]: unknown
  }) => {
    const { src, alt, ...rest } = props
    delete (rest as { fill?: boolean }).fill
    delete (rest as { priority?: boolean }).priority
    return <img src={typeof src === 'string' ? src : src.src} alt={alt} {...rest} />
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

vi.mock('@/components/layout/Navigation', () => ({
  Navigation: () => <nav data-testid="navigation" />,
}))

vi.mock('@/components/wishlist/WishlistButton', () => ({
  WishlistButton: () => <button type="button" aria-label="Wishlist" />,
}))

vi.mock('@/components/recommendations/SimilarProducts', () => ({
  SimilarProducts: () => <div data-testid="similar-products" />,
}))

vi.mock('@/components/products/MobileAddToCartBar', () => ({
  MobileAddToCartBar: () => <div data-testid="mobile-add-to-cart-bar" />,
}))

vi.mock('@/hooks/useProductView', () => ({
  useProductView: () => undefined,
}))

vi.mock('@/lib/store/cart', () => ({
  useCartStore: (selector: (state: { addItem: typeof addItemMock }) => unknown) =>
    selector({ addItem: addItemMock }),
}))

const createMockProduct = (): Product => ({
  id: 'prod-1',
  name: 'Limited Drop Hoodie',
  slug: 'limited-drop-hoodie',
  description: 'Heavyweight hoodie with relaxed fit.',
  price: 129.99,
  compareAtPrice: 159.99,
  images: JSON.stringify(['/hoodie-main.jpg', '/hoodie-alt.jpg']),
  isActive: true,
  isFeatured: false,
  maxQuantity: 2,
  category: {
    id: 'cat-1',
    name: 'Hoodies',
    slug: 'hoodies',
  },
  variants: [
    {
      id: 'v-red-s',
      sku: 'SKU-RED-S',
      size: 'S',
      color: 'Red',
      colorHex: '#FF0000',
      inventory: 6,
      isActive: true,
      images: JSON.stringify(['/hoodie-red.jpg']),
    },
    {
      id: 'v-red-m',
      sku: 'SKU-RED-M',
      size: 'M',
      color: 'Red',
      colorHex: '#FF0000',
      inventory: 0,
      isActive: true,
    },
    {
      id: 'v-cream-s',
      sku: 'SKU-CREAM-S',
      size: 'S',
      color: 'Cream',
      colorHex: '#F2E9DC',
      inventory: 9,
      isActive: true,
      images: JSON.stringify(['/hoodie-cream.jpg']),
    },
    {
      id: 'v-cream-m',
      sku: 'SKU-CREAM-M',
      size: 'M',
      color: 'Cream',
      colorHex: '#F2E9DC',
      inventory: 3,
      isActive: true,
    },
  ],
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
})

describe('ProductPageClient selection UX', () => {
  beforeEach(() => {
    addItemMock.mockReset()
    pushMock.mockReset()

    const product = createMockProduct()
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/api/products/slug/')) {
        return {
          ok: true,
          json: async () => product,
        } as Response
      }

      if (url.includes('/reviews')) {
        return {
          ok: true,
          json: async () => ({
            data: [],
            stats: { averageRating: 0, totalReviews: 0, distribution: {} },
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response
    }) as unknown as typeof fetch
  })

  it('updates selected color/size labels and quantity as options change', async () => {
    render(<ProductPageClient slug="limited-drop-hoodie" />)

    await waitFor(() => {
      expect(screen.getByText('Limited Drop Hoodie')).toBeTruthy()
    })

    expect(screen.getByTestId('selected-color-value').textContent).toBe('RED')
    expect(screen.getByTestId('selected-size-value').textContent).toBe('S')
    expect(screen.getByTestId('selected-quantity').textContent).toBe('1')

    fireEvent.click(screen.getByLabelText(/select color cream/i))
    fireEvent.click(screen.getByLabelText(/select size m/i))
    fireEvent.click(screen.getByLabelText('Increase quantity'))

    expect(screen.getByTestId('selected-color-value').textContent).toBe('CREAM')
    expect(screen.getByTestId('selected-size-value').textContent).toBe('M')
    expect(screen.getByTestId('selected-quantity').textContent).toBe('2')
  })

  it('keeps unavailable combinations disabled and visible', async () => {
    render(<ProductPageClient slug="limited-drop-hoodie" />)

    await waitFor(() => {
      expect(screen.getByTestId('selected-size-value')).toBeTruthy()
    })

    const unavailableSizeButton = screen.getByLabelText(/select size m/i) as HTMLButtonElement
    expect(unavailableSizeButton.disabled).toBe(true)
    expect(screen.getByTestId('availability-helper').textContent).toContain('Some sizes are unavailable')

    fireEvent.click(unavailableSizeButton)
    expect(screen.getByTestId('selected-size-value').textContent).toBe('S')
  })

  it('caps quantity and adds the selected variant to bag with capped quantity', async () => {
    render(<ProductPageClient slug="limited-drop-hoodie" />)

    await waitFor(() => {
      expect(screen.getByTestId('add-to-bag-button')).toBeTruthy()
    })

    fireEvent.click(screen.getByLabelText(/select color cream/i))
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    fireEvent.click(screen.getByLabelText('Increase quantity'))

    expect(screen.getByTestId('selected-quantity').textContent).toBe('2')

    fireEvent.click(screen.getByTestId('add-to-bag-button'))

    expect(addItemMock).toHaveBeenCalledTimes(1)
    expect(addItemMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'prod-1' }),
      expect.objectContaining({ id: 'v-cream-s' }),
      2
    )
  })

  it('switches gallery images by selected color even when selected size variant has no images', async () => {
    render(<ProductPageClient slug="limited-drop-hoodie" />)

    await waitFor(() => {
      expect(screen.getByAltText('Limited Drop Hoodie')).toBeTruthy()
    })

    const mainImage = screen.getByAltText('Limited Drop Hoodie') as HTMLImageElement
    expect(mainImage.getAttribute('src')).toContain('/hoodie-red.jpg')

    fireEvent.click(screen.getByLabelText(/select color cream/i))
    fireEvent.click(screen.getByLabelText(/select size m/i))

    await waitFor(() => {
      expect(mainImage.getAttribute('src')).toContain('/hoodie-cream.jpg')
    })
  })
})

describe('ProductPageClient review section', () => {
  const reviewQueryCalls: string[] = []

  const reviewFixtures = [
    {
      id: 'rev-1',
      rating: 5,
      title: 'Review 1',
      comment: 'Amazing quality and fit. Worth every dollar.',
      images: JSON.stringify(['https://cdn.test/rev-1.jpg']),
      customerName: 'Ari',
      isVerified: true,
      helpfulCount: 10,
      notHelpfulCount: 0,
      createdAt: '2026-03-20T10:00:00.000Z',
    },
    {
      id: 'rev-2',
      rating: 5,
      title: 'Review 2',
      comment: 'Looks great in person.',
      images: null,
      customerName: 'Jordan',
      isVerified: false,
      helpfulCount: 2,
      notHelpfulCount: 0,
      createdAt: '2026-03-19T10:00:00.000Z',
    },
    {
      id: 'rev-3',
      rating: 4,
      title: 'Review 3',
      comment: 'Super comfortable hoodie.',
      images: JSON.stringify(['https://cdn.test/rev-3.jpg']),
      customerName: 'Casey',
      isVerified: true,
      helpfulCount: 6,
      notHelpfulCount: 0,
      createdAt: '2026-03-18T10:00:00.000Z',
    },
    {
      id: 'rev-4',
      rating: 4,
      title: 'Review 4',
      comment: 'Would buy again.',
      images: null,
      customerName: 'Sam',
      isVerified: true,
      helpfulCount: 1,
      notHelpfulCount: 0,
      createdAt: '2026-03-17T10:00:00.000Z',
    },
    {
      id: 'rev-5',
      rating: 3,
      title: 'Review 5',
      comment: 'Decent, but sleeves run long.',
      images: JSON.stringify(['https://cdn.test/rev-5.jpg']),
      customerName: 'Lee',
      isVerified: false,
      helpfulCount: 0,
      notHelpfulCount: 0,
      createdAt: '2026-03-16T10:00:00.000Z',
    },
    {
      id: 'rev-6',
      rating: 2,
      title: 'Review 6',
      comment: 'Not my favorite fit.',
      images: null,
      customerName: 'Kai',
      isVerified: true,
      helpfulCount: 0,
      notHelpfulCount: 1,
      createdAt: '2026-03-15T10:00:00.000Z',
    },
    {
      id: 'rev-7',
      rating: 1,
      title: 'Review 7',
      comment: 'Too small for me.',
      images: null,
      customerName: 'Drew',
      isVerified: false,
      helpfulCount: 0,
      notHelpfulCount: 4,
      createdAt: '2026-03-14T10:00:00.000Z',
    },
    {
      id: 'rev-8',
      rating: 4,
      title: 'Review 8',
      comment: 'Great daily hoodie.',
      images: JSON.stringify(['https://cdn.test/rev-8.jpg']),
      customerName: 'Sky',
      isVerified: true,
      helpfulCount: 5,
      notHelpfulCount: 0,
      createdAt: '2026-03-13T10:00:00.000Z',
    },
  ]

  beforeEach(() => {
    addItemMock.mockReset()
    pushMock.mockReset()
    reviewQueryCalls.length = 0

    const product = createMockProduct()

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/api/products/slug/')) {
        return {
          ok: true,
          json: async () => product,
        } as Response
      }

      if (url.includes(`/api/products/${product.id}/reviews`)) {
        reviewQueryCalls.push(url)

        const parsed = new URL(url, 'http://localhost')
        const page = Number(parsed.searchParams.get('page') || '1')
        const limit = Number(parsed.searchParams.get('limit') || '6')
        const sortByParam = parsed.searchParams.get('sortBy') || 'newest'
        const verifiedOnly = parsed.searchParams.get('verified') === 'true'
        const hasMedia = parsed.searchParams.get('hasMedia') === 'true'
        const rating = parsed.searchParams.get('rating')
        const selectedRating = rating ? Number(rating) : null

        let filtered = [...reviewFixtures]

        if (verifiedOnly) {
          filtered = filtered.filter((review) => review.isVerified)
        }
        if (hasMedia) {
          filtered = filtered.filter((review) => review.images)
        }
        if (selectedRating !== null) {
          filtered = filtered.filter((review) => review.rating === selectedRating)
        }

        filtered.sort((a, b) => {
          if (sortByParam === 'helpful') return b.helpfulCount - a.helpfulCount
          if (sortByParam === 'highest') return b.rating - a.rating
          if (sortByParam === 'lowest') return a.rating - b.rating
          if (sortByParam === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })

        const start = (page - 1) * limit
        const paginated = filtered.slice(start, start + limit)
        const totalCount = filtered.length
        const totalPages = Math.ceil(totalCount / limit)

        const totalReviews = reviewFixtures.length
        const ratingDistribution = {
          1: reviewFixtures.filter((review) => review.rating === 1).length,
          2: reviewFixtures.filter((review) => review.rating === 2).length,
          3: reviewFixtures.filter((review) => review.rating === 3).length,
          4: reviewFixtures.filter((review) => review.rating === 4).length,
          5: reviewFixtures.filter((review) => review.rating === 5).length,
        }
        const averageRating =
          reviewFixtures.reduce((sum, review) => sum + review.rating, 0) / totalReviews

        return {
          ok: true,
          json: async () => ({
            data: paginated,
            stats: {
              averageRating: Number(averageRating.toFixed(1)),
              totalReviews,
              distribution: ratingDistribution,
            },
            pagination: {
              page,
              limit,
              totalCount,
              totalPages,
              hasNextPage: page < totalPages,
              hasPreviousPage: page > 1,
            },
          }),
        } as Response
      }

      if (url.includes('/api/reviews/')) {
        return {
          ok: true,
          json: async () => ({ success: true }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response
    }) as unknown as typeof fetch
  })

  it('applies rating/verified/photos filters and updates query + visible count', async () => {
    render(<ProductPageClient slug="limited-drop-hoodie" />)

    await waitFor(() => {
      expect(screen.getByTestId('review-filter-verified')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('review-filter-verified'))
    fireEvent.click(screen.getByTestId('review-filter-photos'))
    fireEvent.click(screen.getByTestId('review-rating-bar-5'))

    await waitFor(() => {
      expect(reviewQueryCalls.some((url) =>
        url.includes('verified=true') && url.includes('hasMedia=true') && url.includes('rating=5')
      )).toBe(true)
    })

    expect(screen.getByText('1 of 1')).toBeTruthy()
    expect(screen.getByText('Review 1')).toBeTruthy()
  })

  it('loads additional review pages with Load More and appends cards', async () => {
    render(<ProductPageClient slug="limited-drop-hoodie" />)

    await waitFor(() => {
      expect(screen.getByText('6 of 8')).toBeTruthy()
    })

    expect(screen.queryByText('Review 8')).toBeNull()

    fireEvent.click(screen.getByTestId('review-load-more'))

    await waitFor(() => {
      expect(screen.getByText('Review 8')).toBeTruthy()
    })
  })

  it('shows empty filtered state and clears filters back to page 1', async () => {
    render(<ProductPageClient slug="limited-drop-hoodie" />)

    await waitFor(() => {
      expect(screen.getByTestId('review-filter-verified')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('review-filter-verified'))
    fireEvent.click(screen.getByTestId('review-filter-photos'))
    fireEvent.click(screen.getByTestId('review-rating-bar-1'))

    await waitFor(() => {
      expect(screen.getByText('No reviews match your current filters.')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('review-filter-clear'))

    await waitFor(() => {
      expect(screen.getByText('6 of 8')).toBeTruthy()
    })

    const lastCall = reviewQueryCalls[reviewQueryCalls.length - 1]
    expect(lastCall).toContain('page=1')
    expect(lastCall).not.toContain('verified=true')
    expect(lastCall).not.toContain('hasMedia=true')
    expect(lastCall).not.toContain('rating=')
  })
})
