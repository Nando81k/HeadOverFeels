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

function detailPayload(overrides?: Partial<Record<string, unknown>>) {
  return {
    collection: {
      id: 'collection-1',
      name: 'Calm Essentials',
      slug: 'calm-essentials',
      description: 'Curated calm styles',
      image: '/collections/calm.jpg',
      isFeatured: true,
      sortOrder: 0,
      productCount: 2,
      totalAssignedCount: 2,
    },
    products: [
      {
        id: 'product-1',
        name: 'Calm Hoodie',
        slug: 'calm-hoodie',
        description: 'Soft fleece hoodie',
        price: 98,
        compareAtPrice: 120,
        images: JSON.stringify(['/products/calm-hoodie.jpg']),
        isActive: true,
        isFeatured: false,
        variants: [
          {
            id: 'variant-1',
            sku: 'SKU-1',
            color: 'Navy',
            colorHex: '#1B2A4A',
            inventory: 8,
            isActive: true,
          },
        ],
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'product-2',
        name: 'Calm Tee',
        slug: 'calm-tee',
        description: 'Cotton tee',
        price: 42,
        compareAtPrice: null,
        images: JSON.stringify(['/products/calm-tee.jpg']),
        isActive: true,
        isFeatured: false,
        variants: [
          {
            id: 'variant-2',
            sku: 'SKU-2',
            color: 'Black',
            colorHex: '#000000',
            inventory: 5,
            isActive: true,
          },
        ],
        createdAt: '2026-03-02T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:00.000Z',
      },
    ],
    filters: {
      search: '',
      sortBy: 'curated',
      inStock: false,
    },
    counts: {
      totalProducts: 2,
      filteredProducts: 2,
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

  it('renders collection details and product cards', async () => {
    render(<CollectionDetailPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Calm Essentials' })).toBeTruthy()
    })

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
          products: [detailPayload().products[0]],
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
