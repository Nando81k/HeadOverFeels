// tests/unit/storefront/search-dialog.test.tsx
import * as React from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}))

// The dialog's default `searchFn` is the server action; stub the module so the
// component under test never reaches the query layer.
vi.mock('@/app/(storefront)/_actions/catalog', () => ({
  predictiveSearchAction: vi.fn(async () => ({ products: [], collections: [] })),
}))

vi.mock('next/image', async () => {
  const react = await import('react')
  const nextOnly = new Set([
    'fill',
    'priority',
    'quality',
    'loader',
    'placeholder',
    'blurDataURL',
    'unoptimized',
    'loading',
    'sizes',
  ])
  return {
    default: (props: Record<string, unknown>) => {
      const attrs: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(props)) {
        if (!nextOnly.has(key)) attrs[key] = value
      }
      return react.createElement('img', attrs)
    },
  }
})

import { SearchDialog } from '@/components/storefront/search/SearchDialog'
import { predictiveSearchAction } from '@/app/(storefront)/_actions/catalog'
import type { ProductCardData, SearchSuggestion } from '@/lib/shopify/types'

/** jsdom implements neither `showModal` nor `close` on `<dialog>`. */
beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
  }
  if (typeof proto.close !== 'function') {
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
})

function card(handle: string, title: string, withImage = false): ProductCardData {
  return {
    id: `gid://shopify/Product/${handle}`,
    handle,
    title,
    availableForSale: true,
    image: withImage
      ? { url: `https://cdn.shopify.com/${handle}.jpg`, altText: title, width: 800, height: 1000 }
      : null,
    hoverImage: null,
    price: { amount: '98.00', currencyCode: 'USD' },
    compareAtPrice: null,
    swatches: [],
    badges: [],
  }
}

const SUGGESTION: SearchSuggestion = {
  products: [card('signal-hoodie', 'Signal Hoodie', true), card('bone-tee', 'Bone Tee')],
  collections: [
    {
      id: 'gid://shopify/Collection/1',
      handle: 'hoodies',
      title: 'Hoodies',
      image: null,
      description: null,
      featured: false,
    },
  ],
}

const EMPTY: SearchSuggestion = { products: [], collections: [] }

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  push.mockReset()
  vi.mocked(predictiveSearchAction).mockClear()
  document.body.className = ''
  document.body.style.overflow = ''
})

function searchInput() {
  return screen.getByLabelText('Search products')
}

describe('SearchDialog', () => {
  it('renders nothing visible while closed', () => {
    render(<SearchDialog open={false} onOpenChange={() => {}} />)
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open')
  })

  it('renders a dialog named Search with a labelled search field', () => {
    render(<SearchDialog open onOpenChange={() => {}} />)

    const dialog = screen.getByRole('dialog', { name: 'Search' })
    const input = within(dialog).getByLabelText('Search products')
    expect(input).toHaveAttribute('type', 'search')
    expect(within(dialog).getByRole('search')).toContainElement(input)
  })

  // `fireEvent`, not `userEvent`: typing helpers await their own timers, which
  // deadlocks against a faked clock.
  it('waits for the debounce and issues one request for the final value', async () => {
    vi.useFakeTimers()
    const searchFn = vi.fn(async () => EMPTY)
    render(<SearchDialog open onOpenChange={() => {}} searchFn={searchFn} />)
    const input = searchInput()

    fireEvent.change(input, { target: { value: 'ho' } })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    fireEvent.change(input, { target: { value: 'hoo' } })
    act(() => {
      vi.advanceTimersByTime(150)
    })

    // The second keystroke restarted the 200ms window.
    expect(searchFn).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(60)
    })

    expect(searchFn).toHaveBeenCalledTimes(1)
    expect(searchFn).toHaveBeenCalledWith('hoo')
  })

  it('never searches for fewer than two characters', async () => {
    vi.useFakeTimers()
    const searchFn = vi.fn(async () => EMPTY)
    render(<SearchDialog open onOpenChange={() => {}} searchFn={searchFn} />)

    fireEvent.change(searchInput(), { target: { value: 'h' } })
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(searchFn).not.toHaveBeenCalled()
  })

  it('marks the results region busy while a request is in flight', async () => {
    const user = userEvent.setup()
    let resolve: (value: SearchSuggestion) => void = () => {}
    const searchFn = vi.fn(
      () =>
        new Promise<SearchSuggestion>((r) => {
          resolve = r
        })
    )
    const { container } = render(<SearchDialog open onOpenChange={() => {}} searchFn={searchFn} />)

    await user.type(searchInput(), 'hoodie')

    const results = container.querySelector('[data-search-results]') as HTMLElement
    expect(results).not.toBeNull()
    await waitFor(() => expect(results).toHaveAttribute('aria-busy', 'true'))
    expect(results.querySelector('[data-skeleton]')).not.toBeNull()

    // The debounce has to elapse before `resolve` is the real resolver.
    await waitFor(() => expect(searchFn).toHaveBeenCalledTimes(1))
    await act(async () => {
      resolve(EMPTY)
    })
    await waitFor(() => expect(results).not.toHaveAttribute('aria-busy'))
  })

  it('lists products and collections as links', async () => {
    const user = userEvent.setup()
    const searchFn = vi.fn(async () => SUGGESTION)
    render(<SearchDialog open onOpenChange={() => {}} searchFn={searchFn} />)

    await user.type(searchInput(), 'hoodie')

    const hoodie = await screen.findByRole('link', { name: /Signal Hoodie/ })
    expect(hoodie).toHaveAttribute('href', '/products/signal-hoodie')
    expect(screen.getByRole('link', { name: /Bone Tee/ })).toHaveAttribute('href', '/products/bone-tee')
    expect(screen.getByRole('link', { name: 'Hoodies' })).toHaveAttribute('href', '/collections/hoodies')

    expect(screen.getByText('Products')).toBeInTheDocument()
    expect(screen.getByText('Collections')).toBeInTheDocument()
    // Price comes from the shared primitive.
    expect(within(hoodie).getByText('$98.00')).toBeInTheDocument()
    expect(hoodie.querySelector('img')).toHaveAttribute('src', 'https://cdn.shopify.com/signal-hoodie.jpg')
  })

  it('shows an empty state naming the query', async () => {
    const user = userEvent.setup()
    const searchFn = vi.fn(async () => EMPTY)
    render(<SearchDialog open onOpenChange={() => {}} searchFn={searchFn} />)

    await user.type(searchInput(), 'zzz')

    expect(await screen.findByText('No results for “zzz”')).toBeInTheDocument()
  })

  it('navigates to the search page on submit and closes', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onNavigate = vi.fn()
    render(
      <SearchDialog
        open
        onOpenChange={onOpenChange}
        onNavigate={onNavigate}
        searchFn={async () => EMPTY}
      />
    )

    await user.type(searchInput(), 'red hoodie{Enter}')

    expect(onNavigate).toHaveBeenCalledWith('/search?q=red%20hoodie')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('falls back to the app router when no onNavigate is given', async () => {
    const user = userEvent.setup()
    render(<SearchDialog open onOpenChange={() => {}} searchFn={async () => EMPTY} />)

    await user.type(searchInput(), 'tee{Enter}')

    expect(push).toHaveBeenCalledWith('/search?q=tee')
  })

  it('does not navigate on an empty submit', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<SearchDialog open onOpenChange={() => {}} onNavigate={onNavigate} />)

    await user.type(searchInput(), '{Enter}')

    expect(onNavigate).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('closes when a result is followed', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<SearchDialog open onOpenChange={onOpenChange} searchFn={async () => SUGGESTION} />)

    await user.type(searchInput(), 'hoodie')
    await user.click(await screen.findByRole('link', { name: /Signal Hoodie/ }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<SearchDialog open onOpenChange={onOpenChange} />)

    await user.keyboard('{Escape}')

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('ignores a stale response that resolves after a newer one', async () => {
    const user = userEvent.setup()
    const resolvers: ((value: SearchSuggestion) => void)[] = []
    const searchFn = vi.fn(
      () =>
        new Promise<SearchSuggestion>((resolve) => {
          resolvers.push(resolve)
        })
    )
    render(<SearchDialog open onOpenChange={() => {}} searchFn={searchFn} />)

    await user.type(searchInput(), 'ho')
    await waitFor(() => expect(resolvers).toHaveLength(1))

    await user.type(searchInput(), 'odie')
    await waitFor(() => expect(resolvers).toHaveLength(2))

    // The newest request answers first, the stale one after it.
    await act(async () => {
      resolvers[1](SUGGESTION)
    })
    await act(async () => {
      resolvers[0](EMPTY)
    })

    expect(await screen.findByRole('link', { name: /Signal Hoodie/ })).toBeInTheDocument()
    expect(screen.queryByText(/No results for/)).toBeNull()
  })
})
