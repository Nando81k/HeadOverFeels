import { AdminLayout } from '@/components/admin/AdminLayout'
import { prisma } from '@/lib/prisma'
import { saveGoals } from './actions'

export default async function GoalsSettingsPage() {
  const goals = await prisma.salesGoals.findUnique({ where: { id: 'default' } })
  const daily = goals?.dailyTarget ?? ''
  const monthly = goals?.monthlyTarget ?? ''

  return (
    <AdminLayout title="Sales Goals" subtitle="Targets that drive the dashboard goals widget">
      <div className="max-w-md">
        <form action={async (fd: FormData) => { await saveGoals(fd) }} className="space-y-4">
          <div>
            <label htmlFor="dailyRevenueGoal" className="block text-[11px] font-semibold text-white/70 mb-1.5">
              Daily revenue goal
            </label>
            <input
              id="dailyRevenueGoal"
              name="dailyRevenueGoal"
              type="number"
              step="100"
              min="0"
              defaultValue={daily}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/40"
              required
            />
          </div>
          <div>
            <label htmlFor="monthlyRevenueGoal" className="block text-[11px] font-semibold text-white/70 mb-1.5">
              Monthly revenue goal
            </label>
            <input
              id="monthlyRevenueGoal"
              name="monthlyRevenueGoal"
              type="number"
              step="1000"
              min="0"
              defaultValue={monthly}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/40"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-gradient-to-b from-red-500 to-red-600 text-white px-4 py-2 rounded-md font-semibold text-sm shadow-[0_4px_12px_rgba(255,49,49,0.3)]"
          >
            Save goals
          </button>
        </form>
      </div>
    </AdminLayout>
  )
}
