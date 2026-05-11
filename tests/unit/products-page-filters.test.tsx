import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductsPage from '@/app/products/page'

const {
  getAllMock,
  replaceMock,
  navState,
} = vi.hoisted(() => ({
  getAllMock: vi.fn(),
  replaceMock: vi.fn(),
  navState: {
    search: '',
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => '/products',
  useSearchParams: () => new URLSearchParams(navState.search),
}))

vi.mock('framer-motion', async () => {
  const React = await import('react')
  const MotionDiv = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  )
  const MotionAside = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <aside {...props}>{children}</aside>
  )

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: MotionDiv,
      aside: MotionAside,
    },
  }
})

vi.mock('@/components/layout/Navigation', () => ({
  Navigation: () => <nav data-testid="navigation" />,
}))

vi.mock('@/components/products/ProductCard', () => ({
  ProductCard: ({ product }: { product: { name: string } }) => (
    <div data-testid="product-card">{product.name}</div>
  ),
  ProductCardSkeleton: () => <div data-testid="product-card-skeleton" />,
}))

vi.mock('@/lib/api/products', () => ({
  productApi: {
    getAll: getAllMock,
  },
}))

function createProductsFixture() {
  return [
    {
      id: 'prod-hoodie',
      name: 'Navy Hoodie',
      slug: 'navy-hoodie',
      description: 'Heavy hoodie',
      price: 120,
      images: JSON.stringify(['/hoodie.jpg']),
      isActive: true,
      isFeatured: true,
      category: {
        id: 'cat-hoodies',
        name: 'Hoodies',
        slug: 'hoodies',
      },
      variants: [
        {
          id: 'var-hoodie-s-navy',
          sku: 'SKU-HOODIE-S-NAVY',
          size: 'S',
          color: 'Navy',
          colorHex: '#1B2A4A',
          inventory: 8,
          isActive: true,
        },
        {
          id: 'var-hoodie-m-black',
          sku: 'SKU-HOODIE-M-BLACK',
          size: 'M',
          color: 'Black',
          colorHex: '#000000',
          inventory: 0,
          isActive: true,
        },
      ],
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
    {
      id: 'prod-tee',
      name: 'Cream Tee',
      slug: 'cream-tee',
      description: 'Cotton tee',
      price: 45,
      images: JSON.stringify(['/tee.jpg']),
      isActive: true,
      isFeatured: false,
      category: {
        id: 'cat-tees',
        name: 'Tees',
        slug: 'tees',
      },
      variants: [
        {
          id: 'var-tee-m-cream',
          sku: 'SKU-TEE-M-CREAM',
          size: 'M',
          color: 'Cream',
          colorHex: '#F2E9DC',
          inventory: 4,
          isActive: true,
        },
      ],
      createdAt: '2026-03-02T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
    },
    {
      id: 'prod-hat',
      name: 'Red Hat',
      slug: 'red-hat',
      description: 'Accessory hat',
      price: 30,
      images: JSON.stringify(['/hat.jpg']),
      isActive: true,
      isFeatured: false,
      category: {
        id: 'cat-accessories',
        name: 'Accessories',
        slug: 'accessories',
      },
      variants: [
        {
          id: 'var-hat-red',
          sku: 'SKU-HAT-RED',
          color: 'Red',
          colorHex: '#BB1E1E',
          inventory: 6,
          isActive: true,
        },
      ],
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:00.000Z',
    },
  ]
}

function getLastReplacePath(): string {
  const lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1]
  return (lastCall?.[0] as string) || ''
}

describe('Products page filter modernization', () => {
  beforeEach(() => {
    navState.search = ''
    replaceMock.mockReset()

    getAllMock.mockResolvedValue({
      data: {
        data: createProductsFixture(),
        pagination: {
          page: 1,
          limit: 100,
          total: 3,
          pages: 1,
        },
      },
    })
  })

  it('shows active chips and supports chip removal with URL sync', async () => {
    navState.search = 'category=hoodies&sizes=S&colors=navy&inStock=true'

    render(<ProductsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('products-active-chips')).toBeTruthy()
    })

    expect(screen.getByTestId('filter-chip-category').textContent).toContain('Hoodies')
    expect(screen.getByTestId('filter-chip-size-S')).toBeTruthy()
    expect(screen.getByTestId('filter-chip-color-navy')).toBeTruthy()

    fireEvent.click(screen.getByTestId('filter-chip-size-S'))

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalled()
    })

    const latest = getLastReplacePath()
    expect(latest).toContain('/products?')
    expect(latest).not.toContain('sizes=')
    expect(latest).toContain('colors=navy')
  })

  it('updates URL and visible products instantly when filters are selected', async () => {
    render(<ProductsPage />)

    await waitFor(() => {
      expect(screen.getAllByTestId('product-card')).toHaveLength(3)
    })

    fireEvent.click(screen.getByTestId('products-filter-trigger'))

    const panel = screen.getAllByTestId('products-filter-panel')[0]
    const searchInput = within(panel).getByPlaceholderText('Search products')
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'nav' } })

    await waitFor(() => {
      expect(within(panel).getByTestId('products-filter-autocomplete-list')).toBeTruthy()
    })

    fireEvent.click(
      within(within(panel).getByTestId('products-filter-autocomplete-list')).getByRole('button', {
        name: /navy hoodie/i,
      })
    )

    await waitFor(() => {
      expect(getLastReplacePath()).toContain('search=Navy+Hoodie')
      expect(screen.getAllByTestId('product-card')).toHaveLength(1)
      expect(screen.getByText('Navy Hoodie')).toBeTruthy()
    })

    fireEvent.click(within(panel).getByLabelText(/filter color navy/i))

    await waitFor(() => {
      expect(getLastReplacePath()).toContain('colors=navy')
      expect(screen.getAllByTestId('product-card')).toHaveLength(1)
      expect(screen.getByText('Navy Hoodie')).toBeTruthy()
    })

    fireEvent.click(within(panel).getByLabelText(/filter size s/i))
    await waitFor(() => {
      expect(getLastReplacePath()).toContain('sizes=S')
    })

    fireEvent.click(within(panel).getByRole('button', { name: 'Under $50' }))
    await waitFor(() => {
      const latest = getLastReplacePath()
      expect(latest).toContain('maxPrice=50')
    })
  })

  it('clears all filters and resets URL + product list', async () => {
    navState.search = 'colors=cream&inStock=true'
    const { rerender } = render(<ProductsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('clear-all-filters')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('clear-all-filters'))

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalled()
      expect(getLastReplacePath()).toBe('/products')
    })

    navState.search = ''
    rerender(<ProductsPage />)

    await waitFor(() => {
      expect(screen.getAllByTestId('product-card')).toHaveLength(3)
    })
  })

  it('rehydrates UI state from URL changes on rerender', async () => {
    navState.search = 'colors=cream'
    const { rerender } = render(<ProductsPage />)

    await waitFor(() => {
      expect(screen.getAllByTestId('product-card')).toHaveLength(1)
      expect(screen.getByText('Cream Tee')).toBeTruthy()
    })

    navState.search = ''
    rerender(<ProductsPage />)

    await waitFor(() => {
      expect(screen.getAllByTestId('product-card')).toHaveLength(3)
    })

    navState.search = 'colors=navy'
    rerender(<ProductsPage />)

    await waitFor(() => {
      expect(screen.getAllByTestId('product-card')).toHaveLength(1)
      expect(screen.getByText('Navy Hoodie')).toBeTruthy()
    })
  })

  it('keeps drawer behavior consistent across duplicated desktop/mobile filter panels', async () => {
    render(<ProductsPage />)

    await waitFor(() => {
      expect(screen.getAllByTestId('product-card')).toHaveLength(3)
    })

    fireEvent.click(screen.getByTestId('products-filter-trigger'))

    const panels = screen.getAllByTestId('products-filter-panel')
    expect(panels.length).toBeGreaterThan(1)

    const mobileLikePanel = panels[1]
    fireEvent.click(within(mobileLikePanel).getByLabelText(/filter color cream/i))

    await waitFor(() => {
      expect(getLastReplacePath()).toContain('colors=cream')
      expect(screen.getAllByTestId('product-card')).toHaveLength(1)
      expect(screen.getByText('Cream Tee')).toBeTruthy()
    })
  })
})
