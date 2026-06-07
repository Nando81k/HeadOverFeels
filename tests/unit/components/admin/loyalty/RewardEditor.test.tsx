import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateReward = vi.fn()
const deleteReward = vi.fn()
const push = vi.fn()
const back = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back }),
}))

vi.mock('@/app/admin/loyalty/actions', () => ({
  updateReward: (...a: unknown[]) => updateReward(...a),
  deleteReward: (...a: unknown[]) => deleteReward(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { RewardEditor } from '@/components/admin/loyalty/RewardEditor'
import type { RewardDetailFull } from '@/app/admin/loyalty/actions'

const detail: RewardDetailFull = {
  id: 'r1',
  name: '10% off',
  slug: '10-off',
  description: 'Save 10%',
  pointsCost: 500,
  rewardType: 'DISCOUNT',
  value: 10,
  isActive: true,
  maxRedemptionsPerCustomer: null,
  totalAvailable: null,
  totalRedeemed: 5,
  minTierRequired: null,
  metadata: null,
  image: null,
  sortOrder: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const tiers = [
  { id: 't1', name: 'Bronze', slug: 'bronze' },
  { id: 't2', name: 'Silver', slug: 'silver' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RewardEditor', () => {
  it('prefills name and slug from detail', () => {
    render(<RewardEditor detail={detail} rewardId="r1" tiers={tiers} />)
    expect((screen.getByLabelText(/^name$/i) as HTMLInputElement).value).toBe('10% off')
    expect((screen.getByLabelText(/^slug$/i) as HTMLInputElement).value).toBe('10-off')
  })

  it('renders rewardType select with 7 options', () => {
    render(<RewardEditor detail={detail} rewardId="r1" tiers={tiers} />)
    const sel = screen.getByLabelText(/reward type/i) as HTMLSelectElement
    expect(sel.options.length).toBe(7)
  })

  it('renders all 7 reward type values', () => {
    render(<RewardEditor detail={detail} rewardId="r1" tiers={tiers} />)
    const sel = screen.getByLabelText(/reward type/i) as HTMLSelectElement
    const values = Array.from(sel.options).map((o) => o.value)
    expect(values).toContain('DISCOUNT')
    expect(values).toContain('FREE_SHIPPING')
    expect(values).toContain('EARLY_ACCESS')
    expect(values).toContain('EXCLUSIVE_PRODUCT')
    expect(values).toContain('CHARITY_DONATION')
    expect(values).toContain('DIGITAL_CONTENT')
    expect(values).toContain('PHYSICAL_PERK')
  })

  it('renders minTierRequired select with tier options from props', () => {
    render(<RewardEditor detail={detail} rewardId="r1" tiers={tiers} />)
    const sel = screen.getByLabelText(/min tier required/i) as HTMLSelectElement
    const slugs = Array.from(sel.options).map((o) => o.value)
    expect(slugs).toContain('bronze')
    expect(slugs).toContain('silver')
    // blank "All tiers" option
    expect(slugs).toContain('')
  })

  it('calls updateReward with correct id and navigates to rewards tab on success', async () => {
    updateReward.mockResolvedValue({ ok: true })
    render(<RewardEditor detail={detail} rewardId="r1" tiers={tiers} />)
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: '15% off' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateReward).toHaveBeenCalled())
    const [id, payload] = updateReward.mock.calls[0]
    expect(id).toBe('r1')
    expect(payload).toMatchObject({ name: '15% off' })
    expect(push).toHaveBeenCalledWith('/admin/loyalty?tab=rewards')
  })

  it('shows error toast and does not navigate on update failure', async () => {
    const { toast } = await import('@/lib/toast')
    updateReward.mockResolvedValue({ ok: false, error: 'Slug conflict' })
    render(<RewardEditor detail={detail} rewardId="r1" tiers={tiers} />)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateReward).toHaveBeenCalled())
    expect(toast.error).toHaveBeenCalledWith('Slug conflict')
    expect(push).not.toHaveBeenCalled()
  })

  it('does NOT render Delete button for non-super-admin', () => {
    render(<RewardEditor detail={detail} rewardId="r1" tiers={tiers} isSuperAdmin={false} />)
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
  })

  it('renders Delete button for super admin', () => {
    render(<RewardEditor detail={detail} rewardId="r1" tiers={tiers} isSuperAdmin={true} />)
    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy()
  })

  it('calls deleteReward and navigates on confirmed delete', async () => {
    vi.stubGlobal('confirm', () => true)
    deleteReward.mockResolvedValue({ ok: true })
    render(<RewardEditor detail={detail} rewardId="r1" tiers={tiers} isSuperAdmin={true} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => expect(deleteReward).toHaveBeenCalledWith('r1'))
    expect(push).toHaveBeenCalledWith('/admin/loyalty?tab=rewards')
    vi.unstubAllGlobals()
  })

  it('does NOT call deleteReward when user cancels confirm dialog', async () => {
    vi.stubGlobal('confirm', () => false)
    render(<RewardEditor detail={detail} rewardId="r1" tiers={tiers} isSuperAdmin={true} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => expect(deleteReward).not.toHaveBeenCalled())
    vi.unstubAllGlobals()
  })

  it('auto-generates slug when name changes', () => {
    render(<RewardEditor detail={detail} rewardId="r1" tiers={tiers} />)
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Free Shirt!' } })
    expect((screen.getByLabelText(/^slug$/i) as HTMLInputElement).value).toBe('free-shirt')
  })

  it('Cancel button calls router.back()', () => {
    render(<RewardEditor detail={detail} rewardId="r1" tiers={tiers} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(back).toHaveBeenCalled()
  })
})
