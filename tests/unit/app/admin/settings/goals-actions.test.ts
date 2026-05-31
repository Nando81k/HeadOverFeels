import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    salesGoals: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn(async () => 'admin-id'),
}))

import { saveGoals } from '@/app/admin/settings/goals/actions'
import { prisma } from '@/lib/prisma'

beforeEach(() => {
  vi.mocked(prisma.salesGoals.upsert).mockReset()
})

describe('saveGoals', () => {
  it('upserts goals when valid', async () => {
    const fd = new FormData()
    fd.set('dailyRevenueGoal', '10000')
    fd.set('monthlyRevenueGoal', '200000')
    const result = await saveGoals(fd)
    expect(result).toEqual({ ok: true })
    expect(prisma.salesGoals.upsert).toHaveBeenCalledTimes(1)
  })

  it('rejects negative numbers', async () => {
    const fd = new FormData()
    fd.set('dailyRevenueGoal', '-5')
    fd.set('monthlyRevenueGoal', '200000')
    const result = await saveGoals(fd)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/positive/i)
  })

  it('rejects non-numeric', async () => {
    const fd = new FormData()
    fd.set('dailyRevenueGoal', 'abc')
    fd.set('monthlyRevenueGoal', '200000')
    const result = await saveGoals(fd)
    expect(result.ok).toBe(false)
  })
})
