import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchModal } from '@/components/search/SearchModal'

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('framer-motion', async () => {
  const React = await import('react')
  const MotionDiv = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: MotionDiv,
    },
  }
})

vi.mock('@/components/ui/ProductImage', () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src?: string
    alt: string
    [key: string]: unknown
  }) => <img src={src || '/placeholder-product.jpg'} alt={alt} {...props} />,
}))

function createProduct(id: string, name: string, slug: string) {
  return {
    id,
    name,
    slug,
    description: `${name} description`,
    price: 79,
    images: JSON.stringify(['/hoodie.jpg']),
    isActive: true,
    isFeatured: true,
    variants: [
      {
        id: `variant-${id}`,
        sku: `SKU-${id}`,
        inventory: 5,
        isActive: true,
      },
    ],
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
  }
}

function okJson(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  } as Response
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function getSearchParam(input: RequestInfo | URL, key: string): string | null {
  const raw = String(input)
  const url = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'http://localhost')
  return url.searchParams.get(key)
}

describe('SearchModal', () => {
  beforeEach(() => {
    pushMock.mockReset()
    localStorage.clear()
  })

  it('renders default suggestions state with quick links and featured products', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('isFeatured=true')) {
        return okJson({ data: [createProduct('feat-1', 'Featured Hoodie', 'featured-hoodie')] })
      }
      return okJson({ data: [] })
    }) as unknown as typeof fetch

    render(<SearchModal isOpen onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByText('Quick Links').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Popular Products').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Featured Hoodie').length).toBeGreaterThan(0)
    })
  })

  it('applies debounce and minimum query length before fetching search results', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('isFeatured=true')) {
        return okJson({ data: [] })
      }
      if (url.includes('search=hood')) {
        return okJson({ data: [createProduct('prod-1', 'Hoodie One', 'hoodie-one')] })
      }
      return okJson({ data: [] })
    })

    global.fetch = fetchMock as unknown as typeof fetch

    render(<SearchModal isOpen onClose={vi.fn()} />)

    const input = screen.getByTestId('search-input-desktop')
    fireEvent.change(input, { target: { value: 'h' } })
    await sleep(300)

    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('search=h'))).toBe(false)

    fireEvent.change(input, { target: { value: 'hood' } })
    await sleep(300)

    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('search=hood'))).toBe(true)
  })

  it('keeps only the newest query results when responses resolve out of order', async () => {
    const oldResult = createProduct('old-1', 'Old Result Hoodie', 'old-result')
    const newResult = createProduct('new-1', 'New Result Hoodie', 'new-result')

    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const search = getSearchParam(input, 'search')
      if (search === null) {
        return Promise.resolve(okJson({ data: [] }))
      }
      if (search === 'ho') {
        return new Promise((resolve) => {
          setTimeout(() => resolve(okJson({ data: [oldResult] })), 100)
        }) as Promise<Response>
      }
      if (search === 'hood') {
        return new Promise((resolve) => {
          setTimeout(() => resolve(okJson({ data: [newResult] })), 10)
        }) as Promise<Response>
      }
      return Promise.resolve(okJson({ data: [] }))
    }) as unknown as typeof fetch

    render(<SearchModal isOpen onClose={vi.fn()} />)
    const input = screen.getByTestId('search-input-desktop')

    fireEvent.change(input, { target: { value: 'ho' } })
    await sleep(260)

    fireEvent.change(input, { target: { value: 'hood' } })
    await sleep(260)
    await sleep(20)

    await waitFor(() => {
      expect(screen.getAllByText((text) => text.includes('New Result')).length).toBeGreaterThan(0)
    })

    await sleep(200)
    expect(screen.queryByText((text) => text.includes('Old Result'))).toBeNull()
  })

  it('supports ArrowDown + Enter keyboard activation for result navigation', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('isFeatured=true')) {
        return okJson({ data: [] })
      }
      if (url.includes('search=hood')) {
        return okJson({ data: [createProduct('prod-2', 'Keyboard Hoodie', 'keyboard-hoodie')] })
      }
      return okJson({ data: [] })
    }) as unknown as typeof fetch

    render(<SearchModal isOpen onClose={vi.fn()} />)
    const input = screen.getByTestId('search-input-desktop')

    fireEvent.change(input, { target: { value: 'hood' } })
    await sleep(300)

    await waitFor(() => {
      expect(screen.getAllByText((text) => text.includes('Keyboard')).length).toBeGreaterThan(0)
    })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await sleep(0)
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(pushMock.mock.calls.some((call) => call[0] === '/products/keyboard-hoodie')).toBe(true)
  })

  it('shows product autocomplete suggestions while typing', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('isFeatured=true')) {
        return okJson({ data: [] })
      }
      if (url.includes('search=hood')) {
        return okJson({ data: [createProduct('prod-10', 'Hoodie Legacy', 'hoodie-legacy')] })
      }
      return okJson({ data: [] })
    }) as unknown as typeof fetch

    render(<SearchModal isOpen onClose={vi.fn()} />)
    const input = screen.getByTestId('search-input-desktop')

    fireEvent.change(input, { target: { value: 'hood' } })
    await sleep(300)

    await waitFor(() => {
      const autocomplete = screen.getByTestId('nav-search-autocomplete')
      const suggestion = within(autocomplete).getByRole('button', { name: /hoodie legacy/i })
      expect(suggestion).toBeTruthy()
    })

    fireEvent.click(
      within(screen.getByTestId('nav-search-autocomplete')).getByRole('button', {
        name: /hoodie legacy/i,
      })
    )
    expect(pushMock).toHaveBeenCalledWith('/products?search=Hoodie%20Legacy')
  })

  it('supports view-all action and recent search dedupe + clear', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('isFeatured=true')) {
        return okJson({ data: [] })
      }
      if (url.includes('search=navy')) {
        return okJson({ data: [createProduct('prod-3', 'Navy Hoodie', 'navy-hoodie')] })
      }
      return okJson({ data: [] })
    }) as unknown as typeof fetch

    render(<SearchModal isOpen onClose={vi.fn()} />)
    const input = screen.getByTestId('search-input-desktop')

    fireEvent.change(input, { target: { value: 'navy' } })
    await sleep(300)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /View all results for/i }).length).toBeGreaterThan(0)
    })
    fireEvent.click(screen.getAllByRole('button', { name: /View all results for/i })[0])
    expect(pushMock).toHaveBeenCalledWith('/products?search=navy')

    fireEvent.change(input, { target: { value: 'Navy' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: 'navy' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    const stored = JSON.parse(localStorage.getItem('headoverfeels_recent_searches') || '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0]).toBe('navy')

    fireEvent.change(input, { target: { value: '' } })
    await waitFor(() => {
      expect(screen.getAllByText('Clear all').length).toBeGreaterThan(0)
    })
    fireEvent.click(screen.getAllByText('Clear all')[0])
    expect(localStorage.getItem('headoverfeels_recent_searches')).toBeNull()
  })
})
