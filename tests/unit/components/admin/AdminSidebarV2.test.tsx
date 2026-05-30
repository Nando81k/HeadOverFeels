// tests/unit/components/admin/AdminSidebarV2.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AdminSidebarV2 } from '@/components/admin/v2/AdminSidebarV2'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/products',
}))

describe('AdminSidebarV2', () => {
  it('renders all 8 top-level destinations', () => {
    render(<AdminSidebarV2 pendingOrders={0} />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Products & Drops')).toBeInTheDocument()
    expect(screen.getByText('Fulfillment')).toBeInTheDocument()
    expect(screen.getByText('Customers')).toBeInTheDocument()
    expect(screen.getByText('Loyalty')).toBeInTheDocument()
    expect(screen.getByText('Marketing')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Support')).toBeInTheDocument()
  })

  it('shows pending orders badge on Fulfillment', () => {
    render(<AdminSidebarV2 pendingOrders={7} />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('marks the active route', () => {
    render(<AdminSidebarV2 pendingOrders={0} />)
    // products is active per mock
    const products = screen.getByText('Products & Drops').closest('a')
    expect(products?.className).toMatch(/bg-red-500/)
  })
})
