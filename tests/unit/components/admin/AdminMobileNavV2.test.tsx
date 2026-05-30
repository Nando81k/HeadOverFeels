// tests/unit/components/admin/AdminMobileNavV2.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AdminMobileNavV2 } from '@/components/admin/v2/AdminMobileNavV2'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/products',
}))

describe('AdminMobileNavV2', () => {
  it('renders 4 bottom tabs + More', () => {
    render(<AdminMobileNavV2 pendingOrders={0} activeDrops={0} />)
    expect(screen.getByText('Products')).toBeInTheDocument()
    expect(screen.getByText('Fulfill')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Marketing')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
  })

  it('tapping More opens a bottom sheet with remaining destinations', async () => {
    render(<AdminMobileNavV2 pendingOrders={0} activeDrops={0} />)
    await userEvent.click(screen.getByRole('button', { name: /more/i }))
    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
    expect(await screen.findByText('Customers')).toBeInTheDocument()
    expect(await screen.findByText('Loyalty')).toBeInTheDocument()
    expect(await screen.findByText('Support')).toBeInTheDocument()
  })
})
