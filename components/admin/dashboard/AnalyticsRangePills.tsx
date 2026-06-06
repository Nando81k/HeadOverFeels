'use client'

import { useRouter } from 'next/navigation'
import { TabPills, type TabPillsTab } from '@/components/ui/TabPills'
import type { AnalyticsTab, TimeRange } from '@/lib/admin/analytics'

interface AnalyticsRangePillsProps {
  ranges: ReadonlyArray<{ id: TimeRange; label: string }>
  active: TimeRange
  tab: AnalyticsTab
}

/**
 * Client-side wrapper around TabPills used as a horizontal range selector.
 * Drives range changes via router.push and preserves the current tab in the
 * query string. Default range is 30d (enforced by the V2 root parser).
 */
export function AnalyticsRangePills({ ranges, active, tab }: AnalyticsRangePillsProps) {
  const router = useRouter()

  const pillTabs: TabPillsTab[] = ranges.map((r) => ({ id: r.id, label: r.label }))

  return (
    <TabPills
      tabs={pillTabs}
      active={active}
      onChange={(id) => router.push(`?tab=${tab}&range=${id}`)}
      showShortcutHints={false}
    />
  )
}
