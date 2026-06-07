'use client'

import { useRouter } from 'next/navigation'
import { TabPills, type TabPillsTab } from '@/components/ui/TabPills'
import type { LoyaltyTab, TimeRange } from '@/lib/admin/loyalty'

interface LoyaltyTabPillsProps {
  tabs: ReadonlyArray<{ id: LoyaltyTab; label: string }>
  active: LoyaltyTab
  range: TimeRange
}

/**
 * Client-side wrapper around TabPills that drives loyalty tab changes via
 * router.push. Splits the client/server boundary so the V2 root can remain a
 * server component. Preserves the current range in the query string when
 * switching tabs.
 */
export function LoyaltyTabPills({ tabs, active, range }: LoyaltyTabPillsProps) {
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
