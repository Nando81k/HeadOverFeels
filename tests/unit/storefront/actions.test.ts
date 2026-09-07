// tests/unit/storefront/actions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The action modules reach `lib/shopify/client`, which imports `server-only`.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

vi.mock('@/lib/newsletter/subscribers', () => ({ subscribeToNewsletter: vi.fn() }))
vi.mock('@/lib/shopify/queries', () => ({
  getCollectionProducts: vi.fn(),
  getPredictiveSearch: vi.fn(),
  getSearchResults: vi.fn(),
}))

import {
  loadMoreCollectionProducts,
  loadMoreSearchResults,
  predictiveSearchAction,
} from '@/app/(storefront)/_actions/catalog'
import { subscribeNewsletterAction } from '@/app/(storefront)/_actions/newsletter'
import { subscribeToNewsletter } from '@/lib/newsletter/subscribers'
import {
  getCollectionProducts,
  getPredictiveSearch,
  getSearchResults,
} from '@/lib/shopify/queries'
import type { ProductCardData } from '@/lib/shopify/types'

const CARD: ProductCardData = {
  id: 'gid://shopify/Product/1',
  handle: 'signal-hoodie',
  title: 'Signal Hoodie',
  availableForSale: true,
  image: null,
  hoverImage: null,
  price: { amount: '98.00', currencyCode: 'USD' },
  compareAtPrice: null,
  swatches: [],
  badges: [],
}

const PAGE_INFO = { hasNextPage: true, endCursor: 'cursor-2' }

function collectionPage() {
  return {
    collection: {
      id: 'gid://shopify/Collection/1',
      handle: 'all',
      title: 'All',
      descriptionHtml: '',
      image: null,
      description: null,
      featured: false,
    },
    products: [CARD],
    filters: [],
    pageInfo: PAGE_INFO,
  }
}

const EMPTY_SLICE = { products: [], pageInfo: { hasNextPage: false, endCursor: null } }

beforeEach(() => {
  vi.mocked(subscribeToNewsletter).mockReset()
  vi.mocked(getCollectionProducts).mockReset()
  vi.mocked(getPredictiveSearch).mockReset()
  vi.mocked(getSearchResults).mockReset()
})

function formData(entries: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.append(key, value)
  return data
}

const IDLE = { status: 'idle', message: '' } as const

describe('subscribeNewsletterAction', () => {
  it('short-circuits the honeypot with a success message and never persists', async () => {
    const state = await subscribeNewsletterAction(
      IDLE,
      formData({ email: 'bot@example.com', company: 'Acme Bots' })
    )

    expect(state).toEqual({
      status: 'success',
      message: "Thanks for subscribing! You're on the list.",
    })
    expect(subscribeToNewsletter).not.toHaveBeenCalled()
  })

  it('ignores an empty honeypot field', async () => {
    vi.mocked(subscribeToNewsletter).mockResolvedValue({
      normalizedEmail: 'fan@example.com',
      alreadySubscribed: false,
      reactivated: false,
    })

    const state = await subscribeNewsletterAction(
      IDLE,
      formData({ email: 'fan@example.com', company: '   ' })
    )

    expect(state.status).toBe('success')
    expect(subscribeToNewsletter).toHaveBeenCalledTimes(1)
  })

  it('rejects an invalid email before touching the database', async () => {
    const state = await subscribeNewsletterAction(IDLE, formData({ email: 'not-an-email' }))

    expect(state).toEqual({ status: 'error', message: 'Enter a valid email address.' })
    expect(subscribeToNewsletter).not.toHaveBeenCalled()
  })

  it('rejects a missing email field', async () => {
    const state = await subscribeNewsletterAction(IDLE, formData({}))

    expect(state).toEqual({ status: 'error', message: 'Enter a valid email address.' })
    expect(subscribeToNewsletter).not.toHaveBeenCalled()
  })

  it('subscribes a new address with the storefront-footer source', async () => {
    vi.mocked(subscribeToNewsletter).mockResolvedValue({
      normalizedEmail: 'fan@example.com',
      alreadySubscribed: false,
      reactivated: false,
    })

    const state = await subscribeNewsletterAction(
      IDLE,
      formData({ email: '  fan@example.com  ' })
    )

    expect(subscribeToNewsletter).toHaveBeenCalledWith({
      email: 'fan@example.com',
      source: 'storefront-footer',
    })
    expect(state).toEqual({
      status: 'success',
      message: "Thanks for subscribing! You're on the list.",
    })
  })

  it('maps an already-subscribed result to the API route message', async () => {
    vi.mocked(subscribeToNewsletter).mockResolvedValue({
      normalizedEmail: 'fan@example.com',
      alreadySubscribed: true,
      reactivated: false,
    })

    const state = await subscribeNewsletterAction(IDLE, formData({ email: 'fan@example.com' }))

    expect(state).toEqual({
      status: 'success',
      message: "You're already subscribed to our newsletter!",
    })
  })

  it('maps a reactivated result to the resubscribe message', async () => {
    vi.mocked(subscribeToNewsletter).mockResolvedValue({
      normalizedEmail: 'fan@example.com',
      alreadySubscribed: false,
      reactivated: true,
    })

    const state = await subscribeNewsletterAction(IDLE, formData({ email: 'fan@example.com' }))

    expect(state).toEqual({
      status: 'success',
      message: "Welcome back! You've been resubscribed to our newsletter.",
    })
  })

  it('maps a thrown error to the generic failure message', async () => {
    vi.mocked(subscribeToNewsletter).mockRejectedValue(new Error('db down'))

    const state = await subscribeNewsletterAction(IDLE, formData({ email: 'fan@example.com' }))

    expect(state).toEqual({ status: 'error', message: 'Failed to subscribe. Please try again.' })
  })
})

describe('loadMoreCollectionProducts', () => {
  it('delegates to getCollectionProducts with the cursor, filters and sort', async () => {
    vi.mocked(getCollectionProducts).mockResolvedValue(collectionPage())

    const result = await loadMoreCollectionProducts({
      handle: 'all',
      after: 'cursor-1',
      filters: [{ available: true }],
      sort: 'newest',
    })

    expect(getCollectionProducts).toHaveBeenCalledWith({
      handle: 'all',
      after: 'cursor-1',
      filters: [{ available: true }],
      sort: 'newest',
      first: 24,
    })
    expect(result).toEqual({ products: [CARD], pageInfo: PAGE_INFO })
  })

  it('returns an empty slice when the collection is unknown', async () => {
    vi.mocked(getCollectionProducts).mockResolvedValue(null)

    await expect(
      loadMoreCollectionProducts({ handle: 'ghosts', after: 'cursor-1', filters: [] })
    ).resolves.toEqual(EMPTY_SLICE)
  })

  it('does not fetch for a blank handle or cursor', async () => {
    await expect(
      loadMoreCollectionProducts({ handle: '  ', after: 'cursor-1', filters: [] })
    ).resolves.toEqual(EMPTY_SLICE)
    await expect(
      loadMoreCollectionProducts({ handle: 'all', after: '', filters: [] })
    ).resolves.toEqual(EMPTY_SLICE)

    expect(getCollectionProducts).not.toHaveBeenCalled()
  })
})

describe('loadMoreSearchResults', () => {
  it('delegates to getSearchResults with the cursor, filters and sort', async () => {
    vi.mocked(getSearchResults).mockResolvedValue({
      products: [CARD],
      filters: [],
      pageInfo: PAGE_INFO,
      totalCount: 12,
    })

    const result = await loadMoreSearchResults({
      q: 'hoodie',
      after: 'cursor-1',
      filters: [{ available: true }],
      sort: 'price-asc',
    })

    expect(getSearchResults).toHaveBeenCalledWith({
      q: 'hoodie',
      after: 'cursor-1',
      filters: [{ available: true }],
      sort: 'price-asc',
      first: 24,
    })
    expect(result).toEqual({ products: [CARD], pageInfo: PAGE_INFO })
  })

  it('does not fetch for a blank query or cursor', async () => {
    await expect(
      loadMoreSearchResults({ q: '   ', after: 'cursor-1', filters: [] })
    ).resolves.toEqual(EMPTY_SLICE)
    await expect(loadMoreSearchResults({ q: 'hoodie', after: '', filters: [] })).resolves.toEqual(
      EMPTY_SLICE
    )

    expect(getSearchResults).not.toHaveBeenCalled()
  })
})

describe('predictiveSearchAction', () => {
  it('delegates to getPredictiveSearch', async () => {
    const suggestion = { products: [CARD], collections: [] }
    vi.mocked(getPredictiveSearch).mockResolvedValue(suggestion)

    await expect(predictiveSearchAction('  hoodie ')).resolves.toEqual(suggestion)
    expect(getPredictiveSearch).toHaveBeenCalledWith('hoodie')
  })

  it('returns an empty suggestion for a blank query without fetching', async () => {
    await expect(predictiveSearchAction('   ')).resolves.toEqual({
      products: [],
      collections: [],
    })
    expect(getPredictiveSearch).not.toHaveBeenCalled()
  })
})
