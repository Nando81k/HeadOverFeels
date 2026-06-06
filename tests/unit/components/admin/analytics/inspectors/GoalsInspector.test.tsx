// tests/unit/components/admin/analytics/inspectors/GoalsInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateSalesGoals = vi.fn()
vi.mock('@/app/admin/analytics/actions', () => ({
  updateSalesGoals: (...a: unknown[]) => updateSalesGoals(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { GoalsInspector } from '@/components/admin/analytics/inspectors/GoalsInspector'

const goals = {
  id: 'default',
  dailyTarget: 500,
  weeklyTarget: 3500,
  monthlyTarget: 15000,
  quarterlyTarget: 45000,
  yearlyTarget: 180000,
  updatedAt: new Date('2026-05-01'),
}

beforeEach(() => vi.clearAllMocks())

describe('GoalsInspector', () => {
  it('shows 5 prefilled target inputs', () => {
    render(<GoalsInspector open goals={goals} onClose={() => {}} onSaved={() => {}} />)
    expect((screen.getByLabelText(/daily target/i) as HTMLInputElement).value).toBe('500')
    expect((screen.getByLabelText(/monthly target/i) as HTMLInputElement).value).toBe('15000')
  })

  it('saves via updateSalesGoals', async () => {
    updateSalesGoals.mockResolvedValue({ ok: true })
    const onSaved = vi.fn()
    render(<GoalsInspector open goals={goals} onClose={() => {}} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText(/daily target/i), { target: { value: '600' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateSalesGoals).toHaveBeenCalled())
    expect(updateSalesGoals.mock.calls[0][0].dailyTarget).toBe(600)
    expect(onSaved).toHaveBeenCalled()
  })
})
