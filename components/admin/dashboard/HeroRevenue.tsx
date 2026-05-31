// components/admin/dashboard/HeroRevenue.tsx
import { HeroMetric } from '@/components/ui/HeroMetric'
import { HeroTimeRangePills } from './HeroTimeRangePills'
import type { HeroRevenueData, TimeRange } from '@/lib/admin/dashboard'

interface Props {
  data: HeroRevenueData
  range: TimeRange
}

export function HeroRevenue({ data, range }: Props) {
  return (
    <HeroMetric
      label={data.label}
      value={data.value}
      trend={data.trend}
      sparklineData={data.sparklineData}
      actions={<HeroTimeRangePills active={range} />}
    />
  )
}
