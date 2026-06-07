// tests/unit/components/admin/loyalty/inspectors/RewardInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateReward = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  updateReward: (...a: unknown[]) => updateReward(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    aside: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <aside {...props}>{children}</aside>
    ),
  },
}))

import { RewardInspector } from '@/components/admin/loyalty/inspectors/RewardInspector'

const reward = {
  id: 'r1',
  name: '10% off',
  slug: '10-off',
  description: 'd',
  pointsCost: 500,
  rewardType: 'DISCOUNT' as const,
  value: 10,
  isActive: true,
  maxRedemptionsPerCustomer: null,
  totalAvailable: null,
  totalRedeemed: 0,
  minTierRequired: null,
  metadata: null,
  image: null,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('RewardInspector', () => {
  it('shows loading when detail null', () => {
    render(<RewardInspector open detail={null} onClose={() => {}} />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })

  it('renders name and exposes editor link', () => {
    render(<RewardInspector open detail={reward} onClose={() => {}} />)
    expect(screen.getByText(/10% off/)).toBeTruthy()
    const link = screen.getByRole('link', { name: /edit details/i }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/admin/loyalty/rewards/r1/edit')
  })

  it('calls updateReward on Save', async () => {
    updateReward.mockResolvedValue({ ok: true })
    render(<RewardInspector open detail={reward} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateReward).toHaveBeenCalledWith('r1', expect.any(Object)))
  })
})
