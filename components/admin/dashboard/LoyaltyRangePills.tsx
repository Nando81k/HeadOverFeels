'use client'

import { useRouter } from 'next/navigation'
import { TabPills, type TabPillsTab } from '@/components/ui/TabPills'
import type { LoyaltyTab, TimeRange } from '@/lib/admin/loyalty'

interface LoyaltyRangePillsProps {
  ranges: ReadonlyArray<{ id: TimeRange; label: string }>
  active: TimeRange
  tab: LoyaltyTab
}

/**
 * Client-side wrapper around TabPills used as a horizontal range selector for
 * the loyalty dashboard. Drives range changes via router.push and preserves the
 * current tab in the query string. Default range is 30d (enforced by the V2
 * root parser).
 */
export function LoyaltyRangePills({ ranges, active, tab }: LoyaltyRangePillsProps) {
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
