/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReactNode } from 'react'
import CollectionsPage from '@/app/collections/page'

const {
  replaceMock,
  navState,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  navState: {
    search: '',
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => '/collections',
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

function collectionFixture() {
  return [
    {
      id: 'collection-1',
      name: 'Calm Essentials',
      slug: 'calm-essentials',
      description: 'Soft layers and elevated basics.',
      image: '/collections/calm.jpg',
      isActive: true,
      isFeatured: true,
      sortOrder: 0,
      products: [
        {
          sortOrder: 0,
          product: {
            id: 'product-1',
            name: 'Calm Hoodie',
            slug: 'calm-hoodie',
            price: 98,
            images: JSON.stringify(['/products/calm-hoodie.jpg']),
            variants: [],
          },
        },
      ],
      _count: {
        products: 1,
      },
    },
    {
      id: 'collection-2',
      name: 'Weekend Core',
      slug: 'weekend-core',
      description: 'Simple fits for daily rotation.',
      image: null,
      isActive: true,
      isFeatured: false,
      sortOrder: 1,
      products: [
        {
          sortOrder: 0,
          product: {
            id: 'product-2',
            name: 'Weekend Tee',
            slug: 'weekend-tee',
            price: 44,
            images: JSON.stringify(['/products/weekend-tee.jpg']),
            variants: [],
          },
        },
      ],
      _count: {
        products: 1,
      },
    },
  ]
}

describe('Collections index page', () => {
  beforeEach(() => {
    navState.search = ''
    replaceMock.mockReset()
    vi.useRealTimers()

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const requestUrl = new URL(String(input), 'http://localhost')
      const search = requestUrl.searchParams.get('search')?.toLowerCase() ?? ''
      const featuredOnly = requestUrl.searchParams.get('featured') === 'featured'

      let data = collectionFixture()

      if (search) {
        data = data.filter((collection) => collection.name.toLowerCase().includes(search))
      }

      if (featuredOnly) {
        data = data.filter((collection) => collection.isFeatured)
      }

      return {
        ok: true,
        json: async () => data,
      } as Response
    }) as unknown as typeof fetch
  })

  it('renders collection cards and links to canonical slug pages', async () => {
    render(<CollectionsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('collections-grid')).toBeTruthy()
    })

    expect(screen.getByRole('link', { name: /Calm Essentials/i }).getAttribute('href')).toBe('/collections/calm-essentials')
    expect(screen.getByRole('link', { name: /Weekend Core/i }).getAttribute('href')).toBe('/collections/weekend-core')
  })

  it('debounces search query updates into URL params', async () => {
    render(<CollectionsPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search collections')).toBeTruthy()
    })

    fireEvent.change(screen.getByPlaceholderText('Search collections'), {
      target: { value: 'calm' },
    })

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/collections?search=calm', { scroll: false })
    })
  })

  it('supports featured toggle and clear-all behavior', async () => {
    navState.search = 'search=calm&featured=featured&sortBy=name'
    const { rerender } = render(<CollectionsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('collections-active-filters')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))

    expect(replaceMock).toHaveBeenCalledWith('/collections', { scroll: false })

    navState.search = ''
    rerender(<CollectionsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Featured' }))
    expect(replaceMock).toHaveBeenCalledWith('/collections?featured=featured', { scroll: false })
  })

  it('renders filtered-empty state when no collections match', async () => {
    navState.search = 'search=missing'
    render(<CollectionsPage />)

    await waitFor(() => {
      expect(screen.getByText('No collections match your filters')).toBeTruthy()
    })
  })
})
