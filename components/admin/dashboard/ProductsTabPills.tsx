'use client'

import { useRouter } from 'next/navigation'
import { TabPills, type TabPillsTab } from '@/components/ui/TabPills'
import type { ProductsTab } from '@/lib/admin/products'

interface ProductsTabPillsProps {
  tabs: ReadonlyArray<{ id: ProductsTab; label: string }>
  active: ProductsTab
}

/**
 * Client-side wrapper around TabPills that drives tab changes via router.push.
 * Splits the client/server boundary so the V2 root can remain a server component.
 */
export function ProductsTabPills({ tabs, active }: ProductsTabPillsProps) {
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
