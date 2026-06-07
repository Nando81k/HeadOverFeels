// tests/unit/components/admin/loyalty/inspectors/MemberInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const recomputeMemberTier = vi.fn()
vi.mock('@/app/admin/loyalty/actions', () => ({
  recomputeMemberTier: (...a: unknown[]) => recomputeMemberTier(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/admin/loyalty/MemberLedger', () => ({
  MemberLedger: () => <div data-testid="member-ledger" />,
}))
vi.mock('@/components/admin/loyalty/AdjustPointsDialog', () => ({
  AdjustPointsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="adjust-dialog-open" /> : null,
}))

import { MemberInspector } from '@/components/admin/loyalty/inspectors/MemberInspector'

const member = {
  id: 'c1', email: 'a@e.com', name: 'Ada',
  tierId: 't1', tierName: 'Silver', tierColor: '#aaaaaa',
  currentPoints: 250, lifetimePoints: 1500, annualPointsEarned: 800,
  tierStartDate: new Date('2026-01-01'), lastOrderDate: new Date('2026-05-20'),
  transactions: [],
}

beforeEach(() => vi.clearAllMocks())

describe('MemberInspector', () => {
  it('shows loading when detail null', () => {
    render(<MemberInspector open detail={null} isSuperAdmin onClose={() => {}} />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })
  it('renders email + tier + points + ledger', () => {
    render(<MemberInspector open detail={member} isSuperAdmin onClose={() => {}} />)
    expect(screen.getByText(/a@e\.com/)).toBeTruthy()
    expect(screen.getByText(/Silver/)).toBeTruthy()
    expect(screen.getByTestId('member-ledger')).toBeTruthy()
  })
  it('opens AdjustPointsDialog on click', () => {
    render(<MemberInspector open detail={member} isSuperAdmin onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /adjust points/i }))
    expect(screen.getByTestId('adjust-dialog-open')).toBeTruthy()
  })
  it('calls recomputeMemberTier on click', async () => {
    recomputeMemberTier.mockResolvedValue({ ok: true })
    render(<MemberInspector open detail={member} isSuperAdmin onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /recompute tier/i }))
    await waitFor(() => expect(recomputeMemberTier).toHaveBeenCalledWith('c1'))
  })
})
