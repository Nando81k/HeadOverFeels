import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { RecentTransactionsTable } from '@/components/admin/loyalty/RecentTransactionsTable'

describe('RecentTransactionsTable', () => {
  it('renders empty state', () => {
    render(<RecentTransactionsTable transactions={[]} />)
    expect(screen.getByText(/no recent activity/i)).toBeTruthy()
  })

  it('renders rows with email + points + type pill', () => {
    render(
      <RecentTransactionsTable
        transactions={[
          {
            id: 't1',
            customerEmail: 'a@e.com',
            customerName: 'Ada',
            type: 'PURCHASE',
            points: 50,
            description: 'Order',
            createdAt: new Date(),
          },
        ]}
      />,
    )
    expect(screen.getByText(/a@e\.com/)).toBeTruthy()
    expect(screen.getByText(/PURCHASE/i)).toBeTruthy()
    expect(screen.getByText('+50')).toBeTruthy()
  })

  it('renders negative points for REDEMPTION type', () => {
    render(
      <RecentTransactionsTable
        transactions={[
          {
            id: 't2',
            customerEmail: 'b@e.com',
            customerName: null,
            type: 'REDEMPTION',
            points: -100,
            description: 'Reward redemption',
            createdAt: new Date(),
          },
        ]}
      />,
    )
    expect(screen.getByText('-100')).toBeTruthy()
    expect(screen.getAllByText(/REDEMPTION/i).length).toBeGreaterThan(0)
  })

  it('renders description text', () => {
    render(
      <RecentTransactionsTable
        transactions={[
          {
            id: 't3',
            customerEmail: 'c@e.com',
            customerName: 'Carl',
            type: 'BIRTHDAY',
            points: 200,
            description: 'Happy birthday bonus',
            createdAt: new Date(),
          },
        ]}
      />,
    )
    expect(screen.getByText(/Happy birthday bonus/i)).toBeTruthy()
  })
})
