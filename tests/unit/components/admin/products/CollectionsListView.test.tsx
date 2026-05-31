// tests/unit/components/admin/products/CollectionsListView.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CollectionsListView } from '@/components/admin/products/CollectionsListView'
import type { CollectionListItem } from '@/lib/admin/products'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseCollection: CollectionListItem = {
  id: 'col-1',
  name: 'Summer Essentials',
  slug: 'summer-essentials',
  productCount: 12,
  primaryImage: null,
  updatedAt: new Date('2026-04-15T10:00:00Z'),
}

const collectionWithImage: CollectionListItem = {
  id: 'col-2',
  name: 'New Arrivals',
  slug: 'new-arrivals',
  productCount: 5,
  primaryImage: 'https://example.com/new-arrivals.jpg',
  updatedAt: new Date('2026-05-01T08:00:00Z'),
}

const singleProductCollection: CollectionListItem = {
  id: 'col-3',
  name: 'Limited Edition',
  slug: 'limited-edition',
  productCount: 1,
  primaryImage: null,
  updatedAt: new Date('2026-05-20T12:00:00Z'),
}

const allCollections = [baseCollection, collectionWithImage, singleProductCollection]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderView(
  collections: CollectionListItem[] = allCollections,
  overrides: Partial<React.ComponentProps<typeof CollectionsListView>> = {},
) {
  const props = {
    collections,
    onEdit: vi.fn(),
    ...overrides,
  }
  return { ...render(<CollectionsListView {...props} />), props }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CollectionsListView', () => {
  // ── List rendering ─────────────────────────────────────────────────────────

  describe('list rendering', () => {
    it('renders a card for each collection', () => {
      renderView()
      const cards = screen.getAllByTestId('collection-card')
      expect(cards).toHaveLength(3)
    })

    it('renders collection names', () => {
      renderView()
      expect(screen.getByText('Summer Essentials')).toBeInTheDocument()
      expect(screen.getByText('New Arrivals')).toBeInTheDocument()
      expect(screen.getByText('Limited Edition')).toBeInTheDocument()
    })

    it('renders product count badge with plural label', () => {
      renderView([baseCollection])
      expect(screen.getByText('12 products')).toBeInTheDocument()
    })

    it('renders product count badge with singular label when count is 1', () => {
      renderView([singleProductCollection])
      expect(screen.getByText('1 product')).toBeInTheDocument()
    })

    it('renders the last-updated date', () => {
      renderView([baseCollection])
      // Date: Apr 15, 2026
      expect(screen.getByText(/Updated/)).toBeInTheDocument()
      expect(screen.getByText(/Apr 15, 2026/)).toBeInTheDocument()
    })
  })

  // ── Thumbnail ──────────────────────────────────────────────────────────────

  describe('thumbnail', () => {
    it('renders a placeholder div when primaryImage is null', () => {
      renderView([baseCollection])
      const placeholder = document.querySelector(
        '.bg-gradient-to-br.from-neutral-700.to-neutral-900',
      )
      expect(placeholder).toBeInTheDocument()
    })

    it('renders an img when primaryImage is provided', () => {
      renderView([collectionWithImage])
      const img = screen.getByAltText('New Arrivals')
      expect(img).toBeInTheDocument()
    })
  })

  // ── Edit action ────────────────────────────────────────────────────────────

  describe('edit action', () => {
    it('renders an Edit button for each collection', () => {
      renderView([baseCollection])
      expect(screen.getByLabelText('Edit Summer Essentials')).toBeInTheDocument()
    })

    it('calls onEdit with collection id when Edit button is clicked', () => {
      const { props } = renderView([baseCollection])
      fireEvent.click(screen.getByLabelText('Edit Summer Essentials'))
      expect(props.onEdit).toHaveBeenCalledWith('col-1')
    })
  })

  // ── Empty state ────────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('renders "No collections found." when collections is empty and not loading', () => {
      renderView([])
      expect(screen.getByText('No collections found.')).toBeInTheDocument()
    })

    it('does not render any cards in the empty state', () => {
      renderView([])
      expect(screen.queryByTestId('collection-card')).not.toBeInTheDocument()
    })
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('renders skeleton cards when loading=true', () => {
      renderView([], { loading: true, skeletonCount: 3 })
      // No collection names should appear
      expect(screen.queryByText('Summer Essentials')).not.toBeInTheDocument()
      // Skeleton elements should be present
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('does not render collection cards while loading', () => {
      renderView(allCollections, { loading: true })
      expect(screen.queryByTestId('collection-card')).not.toBeInTheDocument()
    })

    it('does not render empty state while loading', () => {
      renderView([], { loading: true })
      expect(screen.queryByText('No collections found.')).not.toBeInTheDocument()
    })
  })
})
