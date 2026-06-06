'use client'

import { useRouter } from 'next/navigation'
import { TabPills, type TabPillsTab } from '@/components/ui/TabPills'
import type { AnalyticsTab, TimeRange } from '@/lib/admin/analytics'

interface AnalyticsTabPillsProps {
  tabs: ReadonlyArray<{ id: AnalyticsTab; label: string }>
  active: AnalyticsTab
  range: TimeRange
}

/**
 * Client-side wrapper around TabPills that drives tab changes via router.push.
 * Splits the client/server boundary so the V2 root can remain a server component.
 * Preserves the current range in the query string when switching tabs.
 */
export function AnalyticsTabPills({ tabs, active, range }: AnalyticsTabPillsProps) {
  const router = useRouter()

  const pillTabs: TabPillsTab[] = tabs.map((t) => ({ id: t.id, label: t.label }))

  return (
    <TabPills
      tabs={pillTabs}
      active={active}
      onChange={(id) => router.push(`?tab=${id}&range=${range}`)}
      showShortcutHints
    />
  )
}
