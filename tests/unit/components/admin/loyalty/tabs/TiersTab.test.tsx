// tests/unit/components/admin/loyalty/tabs/TiersTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getTierDetailForInspector = vi.fn()
vi.mock('@/app/admin/loyalty/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/loyalty/actions')
  return { ...actual, getTierDetailForInspector: (...a: unknown[]) => getTierDetailForInspector(...a) }
})
vi.mock('@/components/admin/loyalty/inspectors/TierInspector', () => ({
  TierInspector: ({ open, createMode }: { open: boolean; createMode?: boolean }) =>
    open ? <div data-testid={createMode ? 'tier-create' : 'tier-edit'} /> : null,
}))

import { TiersTab } from '@/components/admin/loyalty/tabs/TiersTab'

const tiers = [
  {
    id: 't1', name: 'Bronze', slug: 'bronze', description: null,
    primaryColor: '#64748B', secondaryColor: '#475569',
    minAnnualSpend: 0, minAnnualPoints: 0, isInviteOnly: false,
    pointMultiplier: 1, freeShipping: false, earlyDropAccess: false,
    perks: null, sortOrder: 1, isActive: true, memberCount: 12,
  },
]

beforeEach(() => vi.clearAllMocks())

describe('TiersTab', () => {
  it('renders cards', () => {
    render(<TiersTab tiers={tiers} isSuperAdmin />)
    expect(screen.getByText(/Bronze/)).toBeTruthy()
    expect(screen.getByText(/12 members/i)).toBeTruthy()
  })
  it('opens create inspector', () => {
    render(<TiersTab tiers={tiers} isSuperAdmin />)
    fireEvent.click(screen.getByRole('button', { name: /new tier/i }))
    expect(screen.getByTestId('tier-create')).toBeTruthy()
  })
  it('opens edit inspector on card click', async () => {
    getTierDetailForInspector.mockResolvedValue({ ...tiers[0] })
    render(<TiersTab tiers={tiers} isSuperAdmin />)
    fireEvent.click(screen.getByText(/Bronze/))
    await waitFor(() => expect(screen.queryByTestId('tier-edit')).toBeTruthy())
  })
})
