import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { MemberLedger } from '@/components/admin/loyalty/MemberLedger'

const entries = [
  {
    id: 'p1',
    points: 100,
    type: 'PURCHASE' as const,
    description: 'Order 1',
    createdAt: new Date('2026-01-15'),
    orderId: 'o1',
    redemptionId: null,
    referralId: null,
    reviewId: null,
  },
  {
    id: 'p2',
    points: -50,
    type: 'REDEMPTION' as const,
    description: '10% off',
    createdAt: new Date('2026-01-20'),
    orderId: null,
    redemptionId: 'red1',
    referralId: null,
    reviewId: null,
  },
]

describe('MemberLedger', () => {
  it('empty state', () => {
    render(<MemberLedger entries={[]} />)
    expect(screen.getByText(/no points history/i)).toBeTruthy()
  })

  it('renders 2 rows', () => {
    render(<MemberLedger entries={entries} />)
    expect(screen.getByText(/Order 1/)).toBeTruthy()
    expect(screen.getByText(/10% off/)).toBeTruthy()
  })

  it('filters by type', () => {
    render(<MemberLedger entries={entries} />)
    fireEvent.change(screen.getByLabelText(/filter/i), { target: { value: 'PURCHASE' } })
    expect(screen.getByText(/Order 1/)).toBeTruthy()
    expect(screen.queryByText(/10% off/)).toBeNull()
  })
})
