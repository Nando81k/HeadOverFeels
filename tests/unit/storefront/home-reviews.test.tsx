// tests/unit/storefront/home-reviews.test.tsx — ReviewsStrip + home wiring (Phase 5, Task 2)
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('server-only', () => ({}))
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement('img', { src: String(props.src ?? ''), alt: String(props.alt ?? '') }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/app/(storefront)/_actions/newsletter', () => ({ subscribeNewsletterAction: vi.fn() }))
vi.mock('@/lib/shopify/env', () => ({ hasShopifyEnv: vi.fn(() => false) }))
vi.mock('@/lib/storefront/home-data', () => ({ getHomeData: vi.fn() }))
vi.mock('@/lib/storefront/reviews', () => ({ getHomeReviews: vi.fn(async () => []) }))

import HomePage from '@/app/(storefront)/page'
import { ReviewsStrip } from '@/components/storefront/home/ReviewsStrip'
import { getHomeReviews, type HomeReview } from '@/lib/storefront/reviews'

const REVIEWS: HomeReview[] = [
  {
    id: 'r1',
    rating: 5,
    title: 'Heavy in the best way',
    comment: 'Thick fleece, honest fit.',
    authorName: 'Nando R.',
    isVerified: true,
    createdAt: '2026-10-01T12:00:00.000Z',
    adminReply: null,
    helpfulCount: 0,
    productHandle: 'core-hoodie',
    productTitle: 'Core Hoodie',
  },
  {
    id: 'r2',
    rating: 4,
    title: null,
    comment: 'Runs a touch big; size down.',
    authorName: 'Sam K.',
    isVerified: false,
    createdAt: '2026-09-20T12:00:00.000Z',
    adminReply: null,
    helpfulCount: 0,
    productHandle: 'drop-01-heavyweight-crew',
    productTitle: null,
  },
]

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('ReviewsStrip', () => {
  it('renders nothing with no reviews', () => {
    const { container } = render(<ReviewsStrip reviews={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders one card per review linking to the product reviews anchor', () => {
    render(<ReviewsStrip reviews={REVIEWS} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Worn and reviewed' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Core Hoodie' })).toHaveAttribute('href', '/products/core-hoodie#reviews')
    expect(screen.getByRole('link', { name: 'View product' })).toHaveAttribute('href', '/products/drop-01-heavyweight-crew#reviews')
  })
})

describe('home page', () => {
  it('shows the strip on the unconfigured home page when reviews exist', async () => {
    vi.mocked(getHomeReviews).mockResolvedValue(REVIEWS)
    const { container } = render(await HomePage())
    expect(container.querySelector('[data-reviews-strip]')).not.toBeNull()
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it('omits the strip when there are none', async () => {
    vi.mocked(getHomeReviews).mockResolvedValue([])
    const { container } = render(await HomePage())
    expect(container.querySelector('[data-reviews-strip]')).toBeNull()
  })
})
