// tests/unit/components/admin/products/ProductsListTable.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { ProductsListTable } from '@/components/admin/products/ProductsListTable'
import type { ProductRow } from '@/lib/admin/products'

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

const dropRow: ProductRow = {
  ...baseRow,
  id: 'p2',
  name: 'Travis Scott Cactus Jack Hoodie',
  slug: 'travis-scott-cactus-jack-hoodie',
  sku: 'CJ-HD',
  price: 220,
  inventory: 22,
  isDrop: true,
  dropEndDate: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 h from now
  dropStock: { used: 8, max: 30 },
  status: 'ACTIVE',
}

const archivedRow: ProductRow = {
  ...baseRow,
  id: 'p3',
  name: 'Nike Dunk Low Panda',
  slug: 'nike-dunk-low-panda',
  sku: 'DK-PD',
  price: 110,
  inventory: 156,
  status: 'ARCHIVED',
}

const lowStockRow: ProductRow = {
  ...baseRow,
  id: 'p4',
  name: 'Yeezy Foam Runner',
  slug: 'yeezy-foam-runner',
  sku: 'YZ-FR',
  price: 95,
  inventory: 3,
  status: 'ACTIVE',
}

const noSkuRow: ProductRow = {
  ...baseRow,
  id: 'p5',
  name: 'Mystery Box',
  slug: 'mystery-box',
  sku: null,
  price: 50,
  inventory: 10,
  status: 'ACTIVE',
}

const allRows = [baseRow, dropRow, archivedRow, lowStockRow]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderTable(
  rows: ProductRow[] = allRows,
  overrides: Partial<React.ComponentProps<typeof ProductsListTable>> = {},
) {
  const props = {
    rows,
    selectedIds: new Set<string>(),
    onToggle: vi.fn(),
    onToggleAll: vi.fn(),
    onRowAction: vi.fn(),
    ...overrides,
  }
  return { ...render(<ProductsListTable {...props} />), props }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProductsListTable', () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  describe('column headers', () => {
    it('renders all column headers', () => {
      renderTable()
      expect(screen.getByText('Product')).toBeInTheDocument()
      expect(screen.getByText('SKU')).toBeInTheDocument()
      expect(screen.getByText('Price')).toBeInTheDocument()
      expect(screen.getByText('Stock')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })
  })

  describe('row rendering', () => {
    it('renders product name for each row', () => {
      renderTable()
      expect(screen.getByText('Air Jordan 1 Retro High')).toBeInTheDocument()
      expect(screen.getByText('Travis Scott Cactus Jack Hoodie')).toBeInTheDocument()
      expect(screen.getByText('Nike Dunk Low Panda')).toBeInTheDocument()
      expect(screen.getByText('Yeezy Foam Runner')).toBeInTheDocument()
    })

    it('renders SKU in monospace cell', () => {
      renderTable([baseRow])
      expect(screen.getByText('AJ1-RT')).toBeInTheDocument()
    })

    it('renders "—" when SKU is null', () => {
      renderTable([noSkuRow])
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('renders formatted price', () => {
      renderTable([baseRow])
      expect(screen.getByText('$179')).toBeInTheDocument()
    })

    it('renders inventory value', () => {
      renderTable([baseRow])
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('renders category and variant count in sub-line', () => {
      renderTable([baseRow])
      expect(screen.getByText(/Sneakers/)).toBeInTheDocument()
      expect(screen.getByText(/4 variants/)).toBeInTheDocument()
    })
  })

  // ── Status pills ───────────────────────────────────────────────────────────

  describe('status pills', () => {
    it('renders Active pill for ACTIVE non-drop rows', () => {
      renderTable([baseRow])
      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('renders Archived pill for ARCHIVED rows', () => {
      renderTable([archivedRow])
      expect(screen.getByText('Archived')).toBeInTheDocument()
    })

    it('renders Drop · Live pill for drop rows (not the Active pill)', () => {
      renderTable([dropRow])
      expect(screen.getByText('Drop · Live')).toBeInTheDocument()
      // The Active pill should not appear for this drop row
      const activeTexts = screen.queryAllByText('Active')
      // There should be no standalone "Active" pill — the drop pill replaces it
      expect(activeTexts.length).toBe(0)
    })
  })

  // ── Low-stock warning ──────────────────────────────────────────────────────

  describe('low stock indicator', () => {
    it('shows warning icon when inventory ≤ 10', () => {
      renderTable([lowStockRow])
      expect(screen.getByLabelText('low stock')).toBeInTheDocument()
    })

    it('does not show warning icon when inventory > 10', () => {
      renderTable([baseRow])
      expect(screen.queryByLabelText('low stock')).not.toBeInTheDocument()
    })
  })

  // ── Drop row ───────────────────────────────────────────────────────────────

  describe('drop row', () => {
    it('shows "Drop · Live" pill with pulse indicator', () => {
      renderTable([dropRow])
      const pill = screen.getByText('Drop · Live')
      expect(pill).toBeInTheDocument()
    })

    it('renders drop sub-line with category and live info', () => {
      renderTable([dropRow])
      // The sub-line should contain "Drop · Live until"
      expect(screen.getByText(/Drop · Live until/)).toBeInTheDocument()
    })
  })

  // ── Selection ──────────────────────────────────────────────────────────────

  describe('selection', () => {
    it('renders a select-all checkbox in the header', () => {
      renderTable()
      expect(screen.getByLabelText('Select all products')).toBeInTheDocument()
    })

    it('renders a per-row checkbox for each row', () => {
      renderTable()
      expect(screen.getByLabelText('Select Air Jordan 1 Retro High')).toBeInTheDocument()
      expect(screen.getByLabelText('Select Travis Scott Cactus Jack Hoodie')).toBeInTheDocument()
    })

    it('calls onToggle with row id when a row checkbox is clicked', () => {
      const { props } = renderTable()
      fireEvent.click(screen.getByLabelText('Select Air Jordan 1 Retro High'))
      expect(props.onToggle).toHaveBeenCalledWith('p1')
    })

    it('calls onToggleAll when the header checkbox is clicked', () => {
      const { props } = renderTable()
      fireEvent.click(screen.getByLabelText('Select all products'))
      expect(props.onToggleAll).toHaveBeenCalled()
    })

    it('shows row checkbox as checked when id is in selectedIds', () => {
      renderTable([baseRow], { selectedIds: new Set(['p1']) })
      const checkbox = screen.getByLabelText('Select Air Jordan 1 Retro High') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })

    it('shows header checkbox as checked when all rows are selected', () => {
      renderTable([baseRow], { selectedIds: new Set(['p1']) })
      const headerCheckbox = screen.getByLabelText('Select all products') as HTMLInputElement
      expect(headerCheckbox.checked).toBe(true)
    })
  })

  // ── Row action ─────────────────────────────────────────────────────────────

  describe('row action button', () => {
    it('renders an action button for each row', () => {
      renderTable([baseRow])
      expect(screen.getByLabelText('Actions for Air Jordan 1 Retro High')).toBeInTheDocument()
    })

    it('calls onRowAction with row id when action button is clicked', () => {
      const { props } = renderTable([baseRow])
      fireEvent.click(screen.getByLabelText('Actions for Air Jordan 1 Retro High'))
      expect(props.onRowAction).toHaveBeenCalledWith('p1')
    })
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('renders skeleton rows when loading=true', () => {
      renderTable([], { loading: true, skeletonRows: 3 })
      // No product names should appear
      expect(screen.queryByText('Air Jordan 1 Retro High')).not.toBeInTheDocument()
      // Skeleton elements should be present
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('does not render product rows while loading', () => {
      renderTable(allRows, { loading: true })
      expect(screen.queryAllByTestId('products-table-row')).toHaveLength(0)
    })
  })

  // ── Empty state ────────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('renders "No products found." when rows is empty and not loading', () => {
      renderTable([])
      expect(screen.getByText('No products found.')).toBeInTheDocument()
    })
  })

  // ── Thumbnail ──────────────────────────────────────────────────────────────

  describe('thumbnail', () => {
    it('renders a placeholder div when primaryImage is null', () => {
      renderTable([baseRow])
      // aria-hidden placeholder div should exist
      const placeholder = document.querySelector(
        '.bg-gradient-to-br.from-neutral-700.to-neutral-900',
      )
      expect(placeholder).toBeInTheDocument()
    })

    it('renders an img when primaryImage is provided', () => {
      const rowWithImage: ProductRow = { ...baseRow, primaryImage: 'https://example.com/img.jpg' }
      renderTable([rowWithImage])
      const img = screen.getByAltText('Air Jordan 1 Retro High')
      expect(img).toBeInTheDocument()
    })
  })
})
