// tests/unit/components/admin/loyalty/inspectors/LoyaltySettingsInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateLoyaltySettings = vi.fn()
vi.mock('@/app/admin/loyalty/actions', () => ({
  updateLoyaltySettings: (...a: unknown[]) => updateLoyaltySettings(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// framer-motion: skip animations in jsdom
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    aside: ({
      children,
      style,
      className,
      role,
      'aria-modal': ariaModal,
      'aria-labelledby': ariaLabelledby,
    }: React.HTMLAttributes<HTMLElement> & { style?: React.CSSProperties }) => (
      <aside
        role={role}
        aria-modal={ariaModal as boolean | undefined}
        aria-labelledby={ariaLabelledby}
        style={style}
        className={className}
      >
        {children}
      </aside>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { LoyaltySettingsInspector } from '@/components/admin/loyalty/inspectors/LoyaltySettingsInspector'

const settings = {
  id: 'default',
  isEnabled: true,
  programName: 'Head Over Feels Rewards',
  pointsPerDollar: 1,
  pointsRoundingMode: 'floor',
  minimumOrderForPoints: 0,
  referralPointsReferrer: 100,
  referralPointsReferred: 50,
  referralEnabled: true,
  reviewPointsEnabled: true,
  reviewPointsAmount: 25,
  reviewWithPhotoBonus: 25,
  birthdayRewardsEnabled: true,
  birthdayRewardType: 'points',
  birthdayRewardValue: 100,
  birthdayRewardExpireDays: 30,
  pointsExpireEnabled: true,
  pointsExpireMonths: 12,
  tierEvaluationPeriod: 'annual',
  tierDowngradeEnabled: false,
  showPointsInCart: true,
  showPointsInCheckout: true,
  showTierProgress: true,
  updatedAt: new Date('2026-05-01'),
}

beforeEach(() => vi.clearAllMocks())

describe('LoyaltySettingsInspector', () => {
  it('shows cron fields as read-only with note', () => {
    render(<LoyaltySettingsInspector open settings={settings} onClose={() => {}} />)
    expect(screen.getByText(/12 months/)).toBeTruthy()
    expect(screen.getByText(/annual/)).toBeTruthy()
    expect(screen.getByText(/birthday-points-cron\.yml/)).toBeTruthy()
  })

  it('calls updateLoyaltySettings on Save', async () => {
    updateLoyaltySettings.mockResolvedValue({ ok: true })
    render(<LoyaltySettingsInspector open settings={settings} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/program name/i), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateLoyaltySettings).toHaveBeenCalled())
    expect(updateLoyaltySettings.mock.calls[0][0].programName).toBe('Renamed')
  })
})
