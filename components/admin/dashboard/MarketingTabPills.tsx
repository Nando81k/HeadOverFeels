'use client'

import { useRouter } from 'next/navigation'
import { TabPills, type TabPillsTab } from '@/components/ui/TabPills'
import type { MarketingTab } from '@/lib/admin/marketing'

interface MarketingTabPillsProps {
  tabs: ReadonlyArray<{ id: MarketingTab; label: string }>
  active: MarketingTab
}

/**
 * Client-side wrapper around TabPills that drives tab changes via router.push.
 * Splits the client/server boundary so the V2 root can remain a server component.
 */
export function MarketingTabPills({ tabs, active }: MarketingTabPillsProps) {
  const router = useRouter()

  const pillTabs: TabPillsTab[] = tabs.map((t) => ({ id: t.id, label: t.label }))

  return (
    <TabPills
      tabs={pillTabs}
      active={active}
      onChange={(id) => router.push(`?tab=${id}`)}
      showShortcutHints
    />
  )
}
