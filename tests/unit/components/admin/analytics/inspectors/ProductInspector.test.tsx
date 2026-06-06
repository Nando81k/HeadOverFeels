// tests/unit/components/admin/analytics/inspectors/ProductInspector.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ProductInspector } from '@/components/admin/analytics/inspectors/ProductInspector'

const detail = {
  id: 'p1', name: 'Tee',
  imageUrl: null,
  basePrice: 25,
  unitsSold: 10, revenue: 250, cost: 60, grossMargin: 190, marginPct: 76,
  rangeStart: new Date('2026-04-30'), rangeEnd: new Date('2026-05-30'),
}

describe('ProductInspector', () => {
  it('renders product summary', () => {
    render(<ProductInspector open detail={detail} onClose={() => {}} />)
    expect(screen.getByText(/Tee/)).toBeTruthy()
    expect(screen.getByText(/76/)).toBeTruthy()
  })
  it('exposes product details link', () => {
    render(<ProductInspector open detail={detail} onClose={() => {}} />)
    const link = screen.getByRole('link', { name: /product details/i }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/admin/products/p1')
  })
  it('loading state on null detail', () => {
    render(<ProductInspector open detail={null} onClose={() => {}} />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })
})
