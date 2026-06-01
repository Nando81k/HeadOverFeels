// tests/unit/components/admin/fulfillment/detail/OrderLineItems.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrderLineItems } from '@/components/admin/fulfillment/detail/OrderLineItems'
import type { OrderItemDetail } from '@/lib/admin/fulfillment'

const items: OrderItemDetail[] = [
  { id: 'i1', productId: 'p1', productVariantId: 'v1', quantity: 2, price: 49.99, productName: 'Tee', productImage: '/t.jpg', sku: 'TEE-S-RED', variantDetails: JSON.stringify({ size: 'S', color: 'Red' }) },
  { id: 'i2', productId: 'p2', productVariantId: null, quantity: 1, price: 19.99, productName: 'Hat', productImage: null, sku: null, variantDetails: null },
]

describe('OrderLineItems', () => {
  it('renders each line', () => {
    render(<OrderLineItems items={items} />)
    expect(screen.getByText('Tee')).toBeInTheDocument()
    expect(screen.getByText('Hat')).toBeInTheDocument()
  })

  it('shows variant size + color when available', () => {
    render(<OrderLineItems items={items} />)
    expect(screen.getByText(/S/)).toBeInTheDocument()
    expect(screen.getByText(/Red/)).toBeInTheDocument()
  })

  it('computes subtotal per line', () => {
    render(<OrderLineItems items={items} />)
    expect(screen.getByText('$99.98')).toBeInTheDocument() // 2 * 49.99
    expect(screen.getByText('$19.99')).toBeInTheDocument()
  })

  it('handles null image', () => {
    render(<OrderLineItems items={items} />)
    const placeholders = document.querySelectorAll('[data-testid="line-item-no-image"]')
    expect(placeholders.length).toBeGreaterThan(0)
  })
})
