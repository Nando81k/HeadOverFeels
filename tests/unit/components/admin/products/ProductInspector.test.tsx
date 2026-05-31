// tests/unit/components/admin/products/ProductInspector.test.tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProductInspector } from '@/components/admin/products/ProductInspector'
import type { ProductDetailForInspector } from '@/lib/admin/products'

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Mock the server action so tests don't need a real DB / Next.js runtime.
const mockSaveProductQuickEdit = vi.fn()
vi.mock('@/app/admin/products/actions', () => ({
  saveProductQuickEdit: (...args: unknown[]) => mockSaveProductQuickEdit(...args),
}))

// next/image is already stubbed globally by the vitest setup.

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseProduct: ProductDetailForInspector = {
  id: 'prod-abc',
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

const dropProduct: ProductDetailForInspector = {
  ...baseProduct,
  id: 'prod-drop',
  name: 'Travis Scott Fragment',
  price: 420,
  inventory: 12,
  status: 'ACTIVE',
  isDrop: true,
  dropEndDate: new Date(Date.now() + 3_600_000),
  dropStock: { used: 8, max: 30 },
}

const archivedProduct: ProductDetailForInspector = {
  ...baseProduct,
  id: 'prod-arch',
  name: 'Nike SB Dunk Low',
  status: 'ARCHIVED',
}

const featuredProduct: ProductDetailForInspector = {
  ...baseProduct,
  id: 'prod-feat',
  name: 'Yeezy 350 V2',
  featured: true,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderInspector(
  product: ProductDetailForInspector | null,
  overrides: Partial<React.ComponentProps<typeof ProductInspector>> = {},
) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const result = render(
    <ProductInspector
      product={product}
      onClose={onClose}
      onSaved={onSaved}
      {...overrides}
    />,
  )
  return { ...result, onClose, onSaved }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProductInspector', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Closed state ────────────────────────────────────────────────────────────

  describe('when product is null (closed)', () => {
    it('renders the drawer element but hides it off-screen', () => {
      renderInspector(null)
      const drawer = screen.getByTestId('product-inspector')
      expect(drawer.className).toMatch(/translate-x-full/)
    })

    it('does not render product content when closed', () => {
      renderInspector(null)
      expect(screen.queryByLabelText(/product inspector/i)).toBeInTheDocument()
      expect(screen.queryByLabelText('Close inspector')).not.toBeInTheDocument()
    })
  })

  // ── Open state ──────────────────────────────────────────────────────────────

  describe('when product is provided (open)', () => {
    it('renders the drawer without translate-x-full class', () => {
      renderInspector(baseProduct)
      const drawer = screen.getByTestId('product-inspector')
      expect(drawer.className).not.toMatch(/translate-x-full/)
    })

    it('renders the product name', () => {
      renderInspector(baseProduct)
      expect(screen.getAllByText('Air Jordan 1 Retro High').length).toBeGreaterThan(0)
    })

    it('renders the formatted price', () => {
      renderInspector(baseProduct)
      expect(screen.getByText('$179.00')).toBeInTheDocument()
    })

    it('renders the inventory count', () => {
      renderInspector(baseProduct)
      expect(screen.getByText('42 in stock')).toBeInTheDocument()
    })

    it('renders a Close inspector button', () => {
      renderInspector(baseProduct)
      expect(screen.getByLabelText('Close inspector')).toBeInTheDocument()
    })

    it('calls onClose when X button is clicked', () => {
      const { onClose } = renderInspector(baseProduct)
      fireEvent.click(screen.getByLabelText('Close inspector'))
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('calls onClose when backdrop is clicked', () => {
      const { onClose } = renderInspector(baseProduct)
      // Backdrop is a div with aria-hidden
      const backdrop = document.querySelector('[aria-hidden="true"]')
      expect(backdrop).not.toBeNull()
      fireEvent.click(backdrop!)
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('calls onClose on Escape key', () => {
      const { onClose } = renderInspector(baseProduct)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  // ── Drop product ────────────────────────────────────────────────────────────

  describe('drop product display', () => {
    it('shows Drop pill when isDrop=true', () => {
      renderInspector(dropProduct)
      expect(screen.getByText('Drop')).toBeInTheDocument()
    })

    it('renders the drop-stock progress bar', () => {
      renderInspector(dropProduct)
      expect(screen.getByTestId('drop-stock-bar')).toBeInTheDocument()
    })

    it('shows sold / max counts', () => {
      renderInspector(dropProduct)
      expect(screen.getByText('8 / 30 sold')).toBeInTheDocument()
    })

    it('does not show drop UI for non-drop product', () => {
      renderInspector(baseProduct)
      expect(screen.queryByTestId('drop-stock-bar')).not.toBeInTheDocument()
    })
  })

  // ── Status toggle ───────────────────────────────────────────────────────────

  describe('status toggle', () => {
    it('pre-selects Active button for ACTIVE product', () => {
      renderInspector(baseProduct)
      const activeBtn = screen.getByRole('button', { name: /^active$/i })
      expect(activeBtn).toHaveAttribute('aria-pressed', 'true')
    })

    it('pre-selects Archived button for ARCHIVED product', () => {
      renderInspector(archivedProduct)
      const archivedBtn = screen.getByRole('button', { name: /^archived$/i })
      expect(archivedBtn).toHaveAttribute('aria-pressed', 'true')
    })

    it('switches to Archived when Archived button is clicked', () => {
      renderInspector(baseProduct)
      const archivedBtn = screen.getByRole('button', { name: /^archived$/i })
      fireEvent.click(archivedBtn)
      expect(archivedBtn).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: /^active$/i })).toHaveAttribute('aria-pressed', 'false')
    })

    it('renders only Active and Archived options (no DRAFT)', () => {
      renderInspector(baseProduct)
      expect(screen.queryByRole('button', { name: /draft/i })).not.toBeInTheDocument()
    })
  })

  // ── isFeatured checkbox ─────────────────────────────────────────────────────

  describe('isFeatured checkbox', () => {
    it('is unchecked for non-featured product', () => {
      renderInspector(baseProduct)
      const checkbox = screen.getByRole('checkbox', { name: /featured product/i })
      expect(checkbox).not.toBeChecked()
    })

    it('is checked for featured product', () => {
      renderInspector(featuredProduct)
      const checkbox = screen.getByRole('checkbox', { name: /featured product/i })
      expect(checkbox).toBeChecked()
    })

    it('toggles when clicked', () => {
      renderInspector(baseProduct)
      const checkbox = screen.getByRole('checkbox', { name: /featured product/i })
      fireEvent.click(checkbox)
      expect(checkbox).toBeChecked()
      fireEvent.click(checkbox)
      expect(checkbox).not.toBeChecked()
    })
  })

  // ── Name field ──────────────────────────────────────────────────────────────

  describe('name field', () => {
    it('is pre-filled with the product name', () => {
      renderInspector(baseProduct)
      const input = screen.getByLabelText(/^name$/i)
      expect((input as HTMLInputElement).value).toBe('Air Jordan 1 Retro High')
    })

    it('updates when the user types', () => {
      renderInspector(baseProduct)
      const input = screen.getByLabelText(/^name$/i) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'New Name' } })
      expect(input.value).toBe('New Name')
    })
  })

  // ── Price field ─────────────────────────────────────────────────────────────

  describe('price field', () => {
    it('is pre-filled with the product price', () => {
      renderInspector(baseProduct)
      const input = screen.getByLabelText(/price/i) as HTMLInputElement
      expect(input.value).toBe('179')
    })

    it('updates when the user types', () => {
      renderInspector(baseProduct)
      const input = screen.getByLabelText(/price/i) as HTMLInputElement
      fireEvent.change(input, { target: { value: '250' } })
      expect(input.value).toBe('250')
    })
  })

  // ── Save action ─────────────────────────────────────────────────────────────

  describe('save action', () => {
    it('calls saveProductQuickEdit with correct QuickEditFields on Save click', async () => {
      mockSaveProductQuickEdit.mockResolvedValue({ ok: true })

      renderInspector(baseProduct)

      // Change name and price
      fireEvent.change(screen.getByLabelText(/^name$/i), {
        target: { value: 'Updated Shoe' },
      })
      fireEvent.change(screen.getByLabelText(/price/i), {
        target: { value: '200' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
      })

      expect(mockSaveProductQuickEdit).toHaveBeenCalledWith('prod-abc', {
        name: 'Updated Shoe',
        price: 200,
        status: 'ACTIVE',
        isFeatured: false,
      })
    })

    it('shows success message after a successful save', async () => {
      mockSaveProductQuickEdit.mockResolvedValue({ ok: true })

      const { onSaved } = renderInspector(baseProduct)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
      })

      await waitFor(() =>
        expect(screen.getByRole('status')).toBeInTheDocument(),
      )
      expect(screen.getByRole('status')).toHaveTextContent(/saved successfully/i)
      expect(onSaved).toHaveBeenCalledWith('prod-abc')
    })

    it('shows error message when save fails', async () => {
      mockSaveProductQuickEdit.mockResolvedValue({ ok: false, error: 'Price must be a positive number' })

      renderInspector(baseProduct)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
      })

      await waitFor(() =>
        expect(screen.getByRole('alert')).toBeInTheDocument(),
      )
      expect(screen.getByRole('alert')).toHaveTextContent(/Price must be a positive number/)
    })

    it('shows client-side validation error when name is empty', async () => {
      renderInspector(baseProduct)

      fireEvent.change(screen.getByLabelText(/^name$/i), {
        target: { value: '' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
      })

      expect(screen.getByRole('alert')).toHaveTextContent(/Name is required/i)
      expect(mockSaveProductQuickEdit).not.toHaveBeenCalled()
    })

    it('shows client-side validation error when price is invalid', async () => {
      renderInspector(baseProduct)

      fireEvent.change(screen.getByLabelText(/price/i), {
        target: { value: 'abc' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
      })

      expect(screen.getByRole('alert')).toHaveTextContent(/Price must be a positive number/i)
      expect(mockSaveProductQuickEdit).not.toHaveBeenCalled()
    })

    it('sends isFeatured=true when featured checkbox is checked', async () => {
      mockSaveProductQuickEdit.mockResolvedValue({ ok: true })

      renderInspector(baseProduct)
      const checkbox = screen.getByRole('checkbox', { name: /featured product/i })
      fireEvent.click(checkbox)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
      })

      expect(mockSaveProductQuickEdit).toHaveBeenCalledWith(
        'prod-abc',
        expect.objectContaining({ isFeatured: true }),
      )
    })

    it('sends ARCHIVED status when Archived is selected', async () => {
      mockSaveProductQuickEdit.mockResolvedValue({ ok: true })

      renderInspector(baseProduct)
      fireEvent.click(screen.getByRole('button', { name: /^archived$/i }))

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
      })

      expect(mockSaveProductQuickEdit).toHaveBeenCalledWith(
        'prod-abc',
        expect.objectContaining({ status: 'ARCHIVED' }),
      )
    })
  })

  // ── Cancel button ───────────────────────────────────────────────────────────

  describe('Cancel button', () => {
    it('calls onClose when Cancel is clicked', () => {
      const { onClose } = renderInspector(baseProduct)
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  // ── Reset on product change ─────────────────────────────────────────────────

  describe('form reset when product changes', () => {
    it('resets fields when a new product is rendered', () => {
      const { rerender } = renderInspector(baseProduct)

      // Dirty the name field
      fireEvent.change(screen.getByLabelText(/^name$/i), {
        target: { value: 'Dirty Value' },
      })

      // Swap to a different product
      rerender(
        <ProductInspector
          product={archivedProduct}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      )

      const input = screen.getByLabelText(/^name$/i) as HTMLInputElement
      expect(input.value).toBe('Nike SB Dunk Low')
    })
  })

  // ── Tags omitted ────────────────────────────────────────────────────────────

  describe('tags UI', () => {
    it('does not render any tags input (not in schema)', () => {
      renderInspector(baseProduct)
      expect(screen.queryByLabelText(/tag/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/add tag/i)).not.toBeInTheDocument()
    })
  })
})
