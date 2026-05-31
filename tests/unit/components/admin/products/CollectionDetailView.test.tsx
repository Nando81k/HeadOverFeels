// tests/unit/components/admin/products/CollectionDetailView.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CollectionDetailView } from '@/components/admin/products/CollectionDetailView'
import type { CollectionWithProducts } from '@/lib/admin/products'

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Mock the server action so tests don't need a DB / Next.js runtime.
const mockReorderCollectionProducts = vi.fn()
vi.mock('@/app/admin/products/actions', () => ({
  reorderCollectionProducts: (...args: unknown[]) =>
    mockReorderCollectionProducts(...args),
}))

// Mock dnd-kit to avoid pointer/keyboard sensor wiring in jsdom.
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core')
  return {
    ...actual,
    DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useSensor: vi.fn(),
    useSensors: vi.fn(() => []),
    PointerSensor: vi.fn(),
    KeyboardSensor: vi.fn(),
    closestCenter: actual.closestCenter,
  }
})

vi.mock('@dnd-kit/sortable', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/sortable')>('@dnd-kit/sortable')
  return {
    ...actual,
    SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useSortable: vi.fn(() => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
      isDragging: false,
    })),
    sortableKeyboardCoordinates: actual.sortableKeyboardCoordinates,
    verticalListSortingStrategy: actual.verticalListSortingStrategy,
    arrayMove: actual.arrayMove,
  }
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const collection: CollectionWithProducts = {
  id: 'col-1',
  name: 'Summer Drops',
  description: 'Hot picks for summer.',
  products: [
    { id: 'prod-a', name: 'Air Jordan 1', primaryImage: null, position: 0 },
    { id: 'prod-b', name: 'Nike SB Dunk', primaryImage: null, position: 1 },
    { id: 'prod-c', name: 'Yeezy 350 V2', primaryImage: null, position: 2 },
  ],
}

const emptyCollection: CollectionWithProducts = {
  id: 'col-empty',
  name: 'Empty Collection',
  description: null,
  products: [],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CollectionDetailView', () => {
  beforeEach(() => {
    mockReorderCollectionProducts.mockResolvedValue({ ok: true })
  })

  it('renders the collection name and description', () => {
    render(<CollectionDetailView collection={collection} />)

    expect(screen.getByText('Summer Drops')).toBeInTheDocument()
    expect(screen.getByText('Hot picks for summer.')).toBeInTheDocument()
  })

  it('renders all products in the list', () => {
    render(<CollectionDetailView collection={collection} />)

    expect(screen.getByText('Air Jordan 1')).toBeInTheDocument()
    expect(screen.getByText('Nike SB Dunk')).toBeInTheDocument()
    expect(screen.getByText('Yeezy 350 V2')).toBeInTheDocument()
  })

  it('shows the product count in the header', () => {
    render(<CollectionDetailView collection={collection} />)

    expect(screen.getByText(/3 products/)).toBeInTheDocument()
  })

  it('renders drag handles for each product', () => {
    render(<CollectionDetailView collection={collection} />)

    const handles = screen.getAllByRole('button', { name: /drag to reorder/i })
    expect(handles).toHaveLength(3)
  })

  it('renders position badges (1-indexed)', () => {
    render(<CollectionDetailView collection={collection} />)

    // Badges "1", "2", "3"
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders sortable items', () => {
    render(<CollectionDetailView collection={collection} />)

    const items = screen.getAllByTestId('sortable-item')
    expect(items).toHaveLength(3)
  })

  it('renders the empty state when there are no products', () => {
    render(<CollectionDetailView collection={emptyCollection} />)

    expect(screen.getByText(/no products in this collection/i)).toBeInTheDocument()
    // No items rendered
    expect(screen.queryAllByTestId('sortable-item')).toHaveLength(0)
  })

  it('renders the collection-detail-view container', () => {
    render(<CollectionDetailView collection={collection} />)
    expect(screen.getByTestId('collection-detail-view')).toBeInTheDocument()
  })

  it('uses singular "product" when count is 1', () => {
    const singleProductCollection: CollectionWithProducts = {
      ...collection,
      products: [collection.products[0]],
    }
    render(<CollectionDetailView collection={singleProductCollection} />)

    expect(screen.getByText(/1 product —/)).toBeInTheDocument()
    expect(screen.queryByText(/1 products/)).not.toBeInTheDocument()
  })

  it('omits description when null', () => {
    render(<CollectionDetailView collection={emptyCollection} />)

    // emptyCollection.description is null — no description paragraph
    expect(screen.queryByText('Hot picks for summer.')).not.toBeInTheDocument()
  })
})
