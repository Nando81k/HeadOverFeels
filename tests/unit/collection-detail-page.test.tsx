/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReactNode } from 'react'
import CollectionDetailPage from '@/app/collections/[slug]/page'

const {
  replaceMock,
  navState,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  navState: {
    slug: 'calm-essentials',
    search: '',
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => `/collections/${navState.slug}`,
  useParams: () => ({ slug: navState.slug }),
  useSearchParams: () => new URLSearchParams(navState.search),
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

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string
    alt: string
    [key: string]: unknown
  }) => <img src={src} alt={alt} {...props} />,
}))

vi.mock('@/components/layout/Navigation', () => ({
  Navigation: () => <nav data-testid="navigation" />,
}))

vi.mock('@/components/products/ProductCard', () => ({
  ProductCard: ({ product }: { product: { name: string } }) => (
    <div data-testid="collection-product-card">{product.name}</div>
  ),
}))

function buildProduct(index: number) {
  const isOdd = index % 2 === 1
  return {
    id: `product-${index}`,
    name: `Calm Product ${index}`,
    slug: `calm-product-${index}`,
    description: isOdd ? 'Soft fleece hoodie' : 'Cotton tee',
    price: isOdd ? 98 : 42,
    compareAtPrice: isOdd ? 120 : null,
    images: JSON.stringify([`/products/calm-${index}.jpg`]),
    isActive: true,
    isFeatured: false,
    variants: [
      {
        id: `variant-${index}`,
        sku: `SKU-${index}`,
        color: isOdd ? 'Navy' : 'Black',
        colorHex: isOdd ? '#1B2A4A' : '#000000',
        inventory: 8,
        isActive: true,
      },
    ],
    createdAt: `2026-03-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    updatedAt: `2026-03-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
  }
}

function detailPayload(overrides?: Partial<Record<string, unknown>>, productCount = 2) {
  const products = Array.from({ length: productCount }, (_, index) => buildProduct(index + 1))

  return {
    collection: {
      id: 'collection-1',
      name: 'Calm Essentials',
      slug: 'calm-essentials',
      description: 'Curated calm styles',
      image: '/collections/calm.jpg',
      isFeatured: true,
      sortOrder: 0,
      productCount,
      totalAssignedCount: productCount,
    },
    products,
    filters: {
      search: '',
      sortBy: 'curated',
      inStock: false,
    },
    counts: {
      totalProducts: productCount,
      filteredProducts: productCount,
    },
    meta: {
      requestedSlug: navState.slug,
      resolvedSlug: navState.slug,
      isCanonical: true,
    },
    ...overrides,
  }
}

describe('Collection detail page', () => {
  beforeEach(() => {
    navState.slug = 'calm-essentials'
    navState.search = ''
    replaceMock.mockReset()
    vi.useRealTimers()

    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => detailPayload(),
    } as Response)) as unknown as typeof fetch
  })

  it('renders campaign story sections and product cards', async () => {
    render(<CollectionDetailPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Calm Essentials' })).toBeTruthy()
    })

    expect(screen.getByTestId('collection-story-sections')).toBeTruthy()
    expect(screen.getAllByTestId('collection-product-card')).toHaveLength(2)
    expect(screen.getByText('2 of 2 products')).toBeTruthy()
  })

  it('updates URL params from sort, in-stock, and search controls', async () => {
    render(<CollectionDetailPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Calm Essentials' })).toBeTruthy()
    })

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'priceDesc' },
    })
    expect(replaceMock).toHaveBeenCalledWith('/collections/calm-essentials?sortBy=priceDesc', { scroll: false })

    fireEvent.click(screen.getByRole('checkbox', { name: /In stock only/i }))
    expect(replaceMock).toHaveBeenCalledWith('/collections/calm-essentials?inStock=true', { scroll: false })
  })

  it('redirects legacy slug views to canonical slug path', async () => {
    navState.slug = 'Calm Essentials'
    navState.search = 'search=calm'

    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () =>
        detailPayload({
          meta: {
            requestedSlug: 'Calm Essentials',
            resolvedSlug: 'calm-essentials',
            isCanonical: false,
          },
        }),
    } as Response)) as unknown as typeof fetch

    render(<CollectionDetailPage />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/collections/calm-essentials?search=calm', { scroll: false })
    })
  })

  it('shows filtered empty state when no products match', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () =>
        detailPayload({
          products: [],
          counts: {
            totalProducts: 2,
            filteredProducts: 0,
          },
        }),
    } as Response)) as unknown as typeof fetch

    render(<CollectionDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('No products match your filters')).toBeTruthy()
    })
  })

  it('renders an initial product slice and appends products with load more', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => detailPayload(undefined, 10),
    } as Response)) as unknown as typeof fetch

    render(<CollectionDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('10 of 10 products')).toBeTruthy()
    })

    expect(screen.getAllByTestId('collection-product-card')).toHaveLength(8)
    expect(screen.getByTestId('collection-load-more')).toBeTruthy()

    fireEvent.click(screen.getByTestId('collection-load-more'))

    await waitFor(() => {
      expect(screen.getAllByTestId('collection-product-card')).toHaveLength(10)
    })
  })

  it('hydrates search URL params into detail fetch requests', async () => {
    navState.search = 'search=hoodie'
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () =>
        detailPayload({
          filters: {
            search: 'hoodie',
            sortBy: 'curated',
            inStock: false,
          },
          counts: {
            totalProducts: 2,
            filteredProducts: 1,
          },
          products: [buildProduct(1)],
        }),
    } as Response))
    global.fetch = fetchMock as unknown as typeof fetch

    render(<CollectionDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('1 of 2 products')).toBeTruthy()
    })

    const firstCall = fetchMock.mock.calls[0]?.[0]
    expect(String(firstCall)).toContain('search=hoodie')
  })
})
