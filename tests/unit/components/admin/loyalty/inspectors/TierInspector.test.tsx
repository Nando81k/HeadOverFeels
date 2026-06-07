// tests/unit/components/admin/loyalty/inspectors/TierInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const createTier = vi.fn()
const updateTier = vi.fn()
const deleteTier = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  createTier: (...a: unknown[]) => createTier(...a),
  updateTier: (...a: unknown[]) => updateTier(...a),
  deleteTier: (...a: unknown[]) => deleteTier(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { TierInspector } from '@/components/admin/loyalty/inspectors/TierInspector'

const tier = {
  id: 't1', name: 'Bronze', slug: 'bronze', description: 'Entry tier',
  primaryColor: '#64748B', secondaryColor: '#475569',
  minAnnualSpend: 0, minAnnualPoints: 0, isInviteOnly: false,
  pointMultiplier: 1, freeShipping: false, earlyDropAccess: false,
  perks: null, sortOrder: 1, isActive: true, memberCount: 0,
}

beforeEach(() => vi.clearAllMocks())

describe('TierInspector', () => {
  it('renders empty form in create mode', () => {
    render(<TierInspector open detail={null} createMode isSuperAdmin onClose={() => {}} />)
    expect(screen.getByLabelText(/name/i)).toBeTruthy()
  })
  it('prefills values in edit mode', () => {
    render(<TierInspector open detail={tier} isSuperAdmin onClose={() => {}} />)
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Bronze')
  })
  it('calls createTier on Save in create mode', async () => {
    createTier.mockResolvedValue({ ok: true, data: { id: 't2' } })
    render(<TierInspector open detail={null} createMode isSuperAdmin onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New Tier' } })
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'new-tier' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(createTier).toHaveBeenCalled())
  })
  it('disables Delete when not SUPER_ADMIN', () => {
    render(<TierInspector open detail={tier} isSuperAdmin={false} onClose={() => {}} />)
    const del = screen.getByRole('button', { name: /delete/i }) as HTMLButtonElement
    expect(del.disabled).toBe(true)
    expect(del.title).toMatch(/SUPER_ADMIN/i)
  })
})
