// tests/unit/components/admin/products/ProductsListCardMobile.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProductsListCardMobile } from '@/components/admin/products/ProductsListCardMobile'
import type { ProductRow } from '@/lib/admin/products'

// next/image stub is provided globally by vitest setup

const baseRow: ProductRow = {
  id: 'prod-1',
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

function makeProps(overrides: Partial<ProductRow> = {}) {
  const row = { ...baseRow, ...overrides }
  return {
    row,
    isSelected: false,
    onSelect: vi.fn(),
    onLongPress: vi.fn(),
    onEdit: vi.fn(),
  }
}

describe('ProductsListCardMobile', () => {
  it('renders product name, price, and inventory', () => {
    render(<ProductsListCardMobile {...makeProps()} />)
    expect(screen.getByText('Air Jordan 1 Retro High')).toBeInTheDocument()
    expect(screen.getByText('$179.00')).toBeInTheDocument()
    expect(screen.getByText('42 in stock')).toBeInTheDocument()
  })

  it('shows category and SKU in subtitle', () => {
    render(<ProductsListCardMobile {...makeProps()} />)
    expect(screen.getByText(/Sneakers/)).toBeInTheDocument()
    expect(screen.getByText(/SKU: AJ1-RT/)).toBeInTheDocument()
  })

  it('shows Active badge for ACTIVE non-drop product', () => {
    render(<ProductsListCardMobile {...makeProps()} />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows Archived badge for ARCHIVED product', () => {
    render(<ProductsListCardMobile {...makeProps({ status: 'ARCHIVED' })} />)
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  it('shows Drop · Live badge when isDrop is true', () => {
    render(<ProductsListCardMobile {...makeProps({ isDrop: true, status: 'ACTIVE' })} />)
    expect(screen.getByText(/Drop · Live/)).toBeInTheDocument()
  })

  it('shows low-stock amber color when inventory <= 10', () => {
    render(<ProductsListCardMobile {...makeProps({ inventory: 5 })} />)
    const stockEl = screen.getByText('5 in stock')
    expect(stockEl.className).toMatch(/amber/)
  })

  it('shows red color when inventory is 0 (out of stock)', () => {
    render(<ProductsListCardMobile {...makeProps({ inventory: 0 })} />)
    const stockEl = screen.getByText('0 in stock')
    expect(stockEl.className).toMatch(/red/)
  })

  it('calls onSelect when checkbox is clicked', () => {
    const props = makeProps()
    render(<ProductsListCardMobile {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /select product/i }))
    expect(props.onSelect).toHaveBeenCalledOnce()
  })

  it('calls onEdit when Edit button is clicked', () => {
    const props = makeProps()
    render(<ProductsListCardMobile {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(props.onEdit).toHaveBeenCalledOnce()
  })

  it('calls onLongPress via onContextMenu', () => {
    const props = makeProps()
    render(<ProductsListCardMobile {...props} />)
    const card = screen.getByTestId('products-list-card-mobile')
    fireEvent.contextMenu(card)
    expect(props.onLongPress).toHaveBeenCalledOnce()
  })

  it('shows selected state styling when isSelected=true', () => {
    const props = { ...makeProps(), isSelected: true }
    render(<ProductsListCardMobile {...props} />)
    const card = screen.getByTestId('products-list-card-mobile')
    expect(card.className).toMatch(/\[#FF3131\]/)
  })

  it('shows variant count when variantCount > 1', () => {
    render(<ProductsListCardMobile {...makeProps({ variantCount: 4 })} />)
    expect(screen.getByText('4 variants')).toBeInTheDocument()
  })

  it('does not show variant count when variantCount is 1', () => {
    render(<ProductsListCardMobile {...makeProps({ variantCount: 1 })} />)
    expect(screen.queryByText(/variant/)).not.toBeInTheDocument()
  })

  it('omits SKU segment when sku is null', () => {
    render(<ProductsListCardMobile {...makeProps({ sku: null })} />)
    expect(screen.queryByText(/SKU:/)).not.toBeInTheDocument()
  })

  it('omits category segment when category is null', () => {
    render(<ProductsListCardMobile {...makeProps({ category: null })} />)
    expect(screen.queryByText(/Sneakers/)).not.toBeInTheDocument()
  })
})
