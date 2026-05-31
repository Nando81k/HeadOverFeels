// components/admin/dashboard/KpiStrip.tsx
import { StatCard } from '@/components/ui/StatCard'
import type { KpiData } from '@/lib/admin/dashboard'

interface Props {
  data: KpiData
}

export function KpiStrip({ data }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <StatCard label="UNITS SOLD" value={data.unitsSold.value} trend={data.unitsSold.trend} />
      <StatCard label="AOV" value={data.aov.value} trend={data.aov.trend} />
      <StatCard label="NEW CUSTOMERS" value={data.newCustomers.value} trend={data.newCustomers.trend} />
      <StatCard label="CVR" value={data.cvr.value} trend={data.cvr.trend} />
    </div>
  )
}
