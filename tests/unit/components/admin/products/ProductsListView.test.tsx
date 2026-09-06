// tests/unit/components/admin/products/ProductsListView.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProductsListView } from '@/components/admin/products/ProductsListView'
import type { ProductRow, ProductDetailForInspector } from '@/lib/admin/products'

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Mock the products server actions. ProductsListView fetches inspector data via
// the `getProductDetailForInspector` server action (which calls requireAdmin() →
// cookies() and needs a request scope), so the whole module is replaced here.
// The remaining exports are inert pass-throughs so sibling imports still resolve.
const mockGetProductDetailForInspector =
  vi.fn<(id: string) => Promise<ProductDetailForInspector | null>>()
vi.mock('@/app/admin/products/actions', () => ({
  getProductDetailForInspector: (...args: [string]) => mockGetProductDetailForInspector(...args),
  saveProductQuickEdit: vi.fn(),
  bulkArchive: vi.fn(),
  bulkDelete: vi.fn(),
  bulkDuplicate: vi.fn(),
  bulkChangeCategory: vi.fn(),
  bulkPriceUpdate: vi.fn(),
  bulkAddTag: vi.fn(),
  bulkSetFeatured: vi.fn(),
  approveReview: vi.fn(),
  rejectReview: vi.fn(),
  replyToReview: vi.fn(),
  reorderCollectionProducts: vi.fn(),
  addProductsToCollection: vi.fn(),
  removeProductFromCollection: vi.fn(),
}))

// Mock ProductBulkActionsSheet (framer-motion causes issues in jsdom)
vi.mock('@/components/admin/products/ProductBulkActionsSheet', () => ({
  ProductBulkActionsSheet: ({
    open,
    onClose,
    onSuccess,
    selectedIds,
  }: {
    open: boolean
    onClose: () => void
    onSuccess: () => void
    selectedIds: string[]
  }) =>
    open ? (
      <div data-testid="bulk-actions-sheet">
        <span data-testid="bulk-selected-count">{selectedIds.length}</span>
        <button onClick={onClose}>Close bulk</button>
        <button onClick={onSuccess}>Confirm bulk</button>
      </div>
    ) : null,
}))

// Mock ProductInspector so tests can control it without server actions.
vi.mock('@/components/admin/products/ProductInspector', () => ({
  ProductInspector: ({
    product,
    onClose,
    onSaved,
  }: {
    product: ProductDetailForInspector | null
    onClose: () => void
    onSaved?: (id: string) => void
  }) =>
    product ? (
      <div data-testid="product-inspector">
        <span data-testid="inspector-product-name">{product.name}</span>
        <button onClick={onClose}>Close inspector</button>
        <button onClick={() => onSaved?.(product.id)}>Save</button>
      </div>
    ) : null,
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseRow: ProductRow = {
  id: 'p1',
  name: 'Air Jordan 1 Retro High',
  slug: 'air-jordan-1-retro-high',
  category: 'Sneakers',
  variantCount: 4,
  sku: 'AJ1-RT',
  price: 179,
  inventory: 42,
  status: 'ACTIVE',
  primaryImage: null,
  isDrop: false,
  dropEndDate: null,
  dropStock: null,
  tags: [],
  featured: false,
}

const secondRow: ProductRow = {
  ...baseRow,
  id: 'p2',
  name: 'Nike SB Dunk Low',
  slug: 'nike-sb-dunk-low',
  sku: 'DUNK-LOW',
}

const productDetail: ProductDetailForInspector = {
  id: 'p1',
  name: 'Air Jordan 1 Retro High',
  price: 179,
  inventory: 42,
  status: 'ACTIVE',
  tags: [],
  featured: false,
  primaryImage: null,
  isDrop: false,
  dropEndDate: null,
  dropStock: null,
  accessTier: null,
}

const rows = [baseRow, secondRow]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderView(
  overrides: Partial<React.ComponentProps<typeof ProductsListView>> = {},
) {
  const props = {
    rows,
    loading: false,
    onRefresh: vi.fn(),
    ...overrides,
  }
  return { ...render(<ProductsListView {...props} />), props }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProductsListView', () => {
  beforeEach(() => {
    mockGetProductDetailForInspector.mockResolvedValue(productDetail)
  })

  // ── Desktop table ──────────────────────────────────────────────────────────

  describe('desktop table', () => {
    it('renders ProductsListTable with all rows', () => {
      renderView()
      // Column headers are rendered by the table component
      expect(screen.getByText('Product')).toBeInTheDocument()
      expect(screen.getByText('SKU')).toBeInTheDocument()
      // Row names appear in both table and mobile card — use getAllByText
      expect(screen.getAllByText('Air Jordan 1 Retro High').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Nike SB Dunk Low').length).toBeGreaterThanOrEqual(1)
    })

    it('passes loading=true to ProductsListTable', () => {
      renderView({ rows: [], loading: true })
      // Skeleton rows appear (no product names)
      expect(screen.queryByText('Air Jordan 1 Retro High')).not.toBeInTheDocument()
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  // ── Mobile card list ───────────────────────────────────────────────────────

  describe('mobile card list', () => {
    it('renders a mobile card for each row', () => {
      renderView()
      const cards = screen.getAllByTestId('products-list-card-mobile')
      expect(cards).toHaveLength(2)
    })
  })

  // ── Selection — desktop ────────────────────────────────────────────────────

  describe('row selection', () => {
    it('toggles a single row via the table checkbox', () => {
      renderView()
      const checkbox = screen.getByLabelText('Select Air Jordan 1 Retro High')
      fireEvent.click(checkbox)
      expect((checkbox as HTMLInputElement).checked).toBe(true)
    })

    it('deselects a row on second click', () => {
      renderView()
      const checkbox = screen.getByLabelText('Select Air Jordan 1 Retro High')
      fireEvent.click(checkbox)
      fireEvent.click(checkbox)
      expect((checkbox as HTMLInputElement).checked).toBe(false)
    })

    it('selects all rows via the header checkbox', () => {
      renderView()
      const headerCheckbox = screen.getByLabelText('Select all products')
      fireEvent.click(headerCheckbox)
      // Target the table input checkboxes specifically (type="checkbox")
      const rowCheckboxes = document.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]:not([aria-label="Select all products"])',
      )
      rowCheckboxes.forEach((cb) => {
        expect(cb.checked).toBe(true)
      })
    })

    it('deselects all rows when header checkbox clicked a second time', () => {
      renderView()
      const headerCheckbox = screen.getByLabelText('Select all products')
      fireEvent.click(headerCheckbox) // select all
      fireEvent.click(headerCheckbox) // deselect all
      const rowCheckboxes = document.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]:not([aria-label="Select all products"])',
      )
      rowCheckboxes.forEach((cb) => {
        expect(cb.checked).toBe(false)
      })
    })
  })

  // ── Bulk actions sheet ─────────────────────────────────────────────────────

  describe('bulk actions sheet', () => {
    it('shows the bulk actions sheet when at least one row is selected', () => {
      renderView()
      expect(screen.queryByTestId('bulk-actions-sheet')).not.toBeInTheDocument()
      fireEvent.click(screen.getByLabelText('Select Air Jordan 1 Retro High'))
      expect(screen.getByTestId('bulk-actions-sheet')).toBeInTheDocument()
    })

    it('shows the correct selected count in the sheet', () => {
      renderView()
      fireEvent.click(screen.getByLabelText('Select Air Jordan 1 Retro High'))
      fireEvent.click(screen.getByLabelText('Select Nike SB Dunk Low'))
      expect(screen.getByTestId('bulk-selected-count').textContent).toBe('2')
    })

    it('hides the sheet when onClose is triggered', () => {
      renderView()
      fireEvent.click(screen.getByLabelText('Select Air Jordan 1 Retro High'))
      fireEvent.click(screen.getByText('Close bulk'))
      expect(screen.queryByTestId('bulk-actions-sheet')).not.toBeInTheDocument()
    })

    it('calls onRefresh and hides sheet after bulk success', () => {
      const { props } = renderView()
      fireEvent.click(screen.getByLabelText('Select Air Jordan 1 Retro High'))
      fireEvent.click(screen.getByText('Confirm bulk'))
      expect(props.onRefresh).toHaveBeenCalledOnce()
      expect(screen.queryByTestId('bulk-actions-sheet')).not.toBeInTheDocument()
    })
  })

  // ── Inspector via row action (desktop) ────────────────────────────────────

  describe('product inspector via row action', () => {
    it('opens inspector when ⋯ button is clicked', async () => {
      renderView()
      fireEvent.click(screen.getByLabelText('Actions for Air Jordan 1 Retro High'))
      await waitFor(() => {
        expect(screen.getByTestId('product-inspector')).toBeInTheDocument()
      })
      expect(screen.getByTestId('inspector-product-name').textContent).toBe(
        'Air Jordan 1 Retro High',
      )
    })

    it('calls getProductDetailForInspector with the correct id', async () => {
      renderView()
      fireEvent.click(screen.getByLabelText('Actions for Air Jordan 1 Retro High'))
      await waitFor(() => {
        expect(mockGetProductDetailForInspector).toHaveBeenCalledWith('p1')
      })
    })

    it('closes the inspector when onClose is triggered', async () => {
      renderView()
      fireEvent.click(screen.getByLabelText('Actions for Air Jordan 1 Retro High'))
      await waitFor(() => expect(screen.getByTestId('product-inspector')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Close inspector'))
      expect(screen.queryByTestId('product-inspector')).not.toBeInTheDocument()
    })

    it('calls onRefresh and closes inspector after save', async () => {
      const { props } = renderView()
      fireEvent.click(screen.getByLabelText('Actions for Air Jordan 1 Retro High'))
      await waitFor(() => expect(screen.getByTestId('product-inspector')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Save'))
      expect(props.onRefresh).toHaveBeenCalledOnce()
      expect(screen.queryByTestId('product-inspector')).not.toBeInTheDocument()
    })

    it('does not open inspector when getProductDetailForInspector returns null', async () => {
      mockGetProductDetailForInspector.mockResolvedValueOnce(null)
      renderView()
      fireEvent.click(screen.getByLabelText('Actions for Air Jordan 1 Retro High'))
      await waitFor(() => {
        expect(mockGetProductDetailForInspector).toHaveBeenCalledWith('p1')
      })
      expect(screen.queryByTestId('product-inspector')).not.toBeInTheDocument()
    })
  })

  // ── Inspector via mobile Edit button ──────────────────────────────────────

  describe('product inspector via mobile card Edit button', () => {
    it('opens inspector when Edit is clicked on a mobile card', async () => {
      renderView()
      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      fireEvent.click(editButtons[0])
      await waitFor(() => {
        expect(screen.getByTestId('product-inspector')).toBeInTheDocument()
      })
    })
  })

  // ── Mobile selection via onLongPress ──────────────────────────────────────

  describe('mobile card selection via long-press (context menu)', () => {
    it('selects a card via context menu (long-press)', () => {
      renderView()
      const cards = screen.getAllByTestId('products-list-card-mobile')
      fireEvent.contextMenu(cards[0])
      // After selection, bulk sheet should appear
      expect(screen.getByTestId('bulk-actions-sheet')).toBeInTheDocument()
    })
  })

  // ── Empty rows ─────────────────────────────────────────────────────────────

  describe('empty rows', () => {
    it('renders no mobile cards when rows is empty', () => {
      renderView({ rows: [] })
      expect(screen.queryByTestId('products-list-card-mobile')).not.toBeInTheDocument()
    })

    it('renders empty state in the table when rows is empty', () => {
      renderView({ rows: [] })
      expect(screen.getByText('No products found.')).toBeInTheDocument()
    })
  })

  // ── onRefresh optional ────────────────────────────────────────────────────

  describe('onRefresh prop is optional', () => {
    it('does not throw when onRefresh is undefined and bulk success fires', () => {
      render(<ProductsListView rows={rows} />)
      fireEvent.click(screen.getByLabelText('Select Air Jordan 1 Retro High'))
      expect(() => fireEvent.click(screen.getByText('Confirm bulk'))).not.toThrow()
    })
  })
})
