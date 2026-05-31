// tests/unit/components/admin/dashboard/NeedsAttention.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { NeedsAttention } from '@/components/admin/dashboard/NeedsAttention'
import type { AttentionAlert } from '@/lib/admin/dashboard'

const alerts: AttentionAlert[] = [
  { id: 'orders-awaiting:bulk', type: 'orders', icon: '📦', title: '7 orders awaiting fulfillment', description: 'Oldest: 23 min ago', urgency: 'high', href: '/admin/fulfillment' },
  { id: 'low-stock:bulk', type: 'low-stock', icon: '⚠', title: '12 items low on stock', description: '3 critical (≤3 units)', urgency: 'critical', href: '/admin/products?filter=low-stock' },
]

beforeEach(() => {
  sessionStorage.clear()
})

describe('NeedsAttention', () => {
  it('renders all alerts with count badge in header', () => {
    render(<NeedsAttention initialAlerts={alerts} />)
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.getByText('7 orders awaiting fulfillment')).toBeInTheDocument()
    expect(screen.getByText('12 items low on stock')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // count badge
  })

  it('clicking dismiss button hides the alert + persists in sessionStorage', async () => {
    render(<NeedsAttention initialAlerts={alerts} />)
    const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i })
    await userEvent.click(dismissButtons[0])
    expect(screen.queryByText('7 orders awaiting fulfillment')).not.toBeInTheDocument()
    const dismissed = JSON.parse(sessionStorage.getItem('admin.dashboard.dismissedAlerts') ?? '[]')
    expect(dismissed).toContain('orders-awaiting:bulk')
  })

  it('renders empty state when all alerts are dismissed', async () => {
    render(<NeedsAttention initialAlerts={[alerts[0]]} />)
    const dismiss = screen.getByRole('button', { name: /dismiss/i })
    await userEvent.click(dismiss)
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument()
  })
})
