'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { TabPills, type TabPillsTab } from '@/components/ui/TabPills'
import type { CustomersTab } from '@/lib/admin/customers'

export interface CustomersTabPillsProps {
  tabs: ReadonlyArray<{ id: CustomersTab; label: string }>
  active: CustomersTab
}

export function CustomersTabPills({ tabs, active }: CustomersTabPillsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const range = searchParams?.get('range') ?? '30d'

  const pillTabs: TabPillsTab[] = tabs.map((t) => ({ id: t.id, label: t.label }))

  return (
    <TabPills
      tabs={pillTabs}
      active={active}
      onChange={(id) => router.push(`?tab=${id}&range=${range}`)}
    />
  )
}
