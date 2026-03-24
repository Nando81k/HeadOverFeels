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

  it('renders campaign composition and links cards to canonical slug pages', async () => {
    render(<CollectionsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('collections-grid')).toBeTruthy()
    })

    expect(screen.getByRole('heading', { name: /Curated edits built for everyday shopping/i })).toBeTruthy()
    expect(screen.getByTestId('collections-spotlight')).toBeTruthy()
    const linkHrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(linkHrefs).toContain('/collections/calm-essentials')
    expect(linkHrefs).toContain('/collections/weekend-core')
    expect(screen.getAllByText(/View collection/i).length).toBeGreaterThan(0)
  })

  it('removes search input and keeps filter controls compact', async () => {
    render(<CollectionsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /All collections/i })).toBeTruthy()
    })

    expect(screen.queryByPlaceholderText('Search collections')).toBeNull()
  })

  it('supports featured toggle, sort, and clear behavior', async () => {
    navState.search = 'featured=featured&sortBy=name'
    const { rerender } = render(<CollectionsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear/i })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /clear/i }))

    expect(replaceMock).toHaveBeenCalledWith('/collections', { scroll: false })

    navState.search = ''
    rerender(<CollectionsPage />)

    fireEvent.click(screen.getByRole('button', { name: /Featured/i }))
    expect(replaceMock).toHaveBeenCalledWith('/collections?featured=featured', { scroll: false })

    fireEvent.change(screen.getByRole('combobox', { name: /Sort collections/i }), {
      target: { value: 'productCount' },
    })
    expect(replaceMock).toHaveBeenCalledWith('/collections?sortBy=productCount', { scroll: false })
  })

  it('renders empty state when no collections are returned', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [],
    } as Response)) as unknown as typeof fetch

    render(<CollectionsPage />)

    await waitFor(() => {
      expect(screen.getByText('No collections available right now')).toBeTruthy()
    })
  })
})
