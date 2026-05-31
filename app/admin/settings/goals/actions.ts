'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/admin'

export type SaveResult = { ok: true } | { ok: false; error: string }

export async function saveGoals(formData: FormData): Promise<SaveResult> {
  await (requireAdmin as unknown as () => Promise<unknown>)()

  const dailyRaw = formData.get('dailyRevenueGoal')
  const monthlyRaw = formData.get('monthlyRevenueGoal')

  const daily = parseFloat(String(dailyRaw ?? ''))
  const monthly = parseFloat(String(monthlyRaw ?? ''))

  if (!Number.isFinite(daily) || !Number.isFinite(monthly)) {
    return { ok: false, error: 'Both fields must be numbers' }
  }
  if (daily < 0 || monthly < 0) {
    return { ok: false, error: 'Goals must be positive numbers' }
  }
  if (daily > 1_000_000 || monthly > 100_000_000) {
    return { ok: false, error: 'Goal seems unreasonably large — double-check' }
  }

  await prisma.salesGoals.upsert({
    where: { id: 'default' },
    update: { dailyTarget: daily, monthlyTarget: monthly },
    create: { id: 'default', dailyTarget: daily, monthlyTarget: monthly },
  })

  revalidatePath('/admin')
  revalidatePath('/admin/settings/goals')
  return { ok: true }
}
