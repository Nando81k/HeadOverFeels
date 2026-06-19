'use client'

import { useState, useMemo } from 'react'
import type { CustomerRow } from '@/lib/admin/customers'
import { CustomersListTable } from './CustomersListTable'
import { CustomersListCardMobile } from './CustomersListCardMobile'
import { CustomersBulkSheet } from './CustomersBulkSheet'

export interface CustomersListClientProps {
  rows: CustomerRow[]
  isSuperAdmin: boolean
}

export function CustomersListClient({ rows, isSuperAdmin }: CustomersListClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const allIds = useMemo(() => rows.map((r) => r.id), [rows])
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

  const onToggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onToggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === allIds.length ? new Set() : new Set(allIds),
    )
  }

  const onClear = () => setSelectedIds(new Set())

  return (
    <div className="space-y-3">
      <CustomersListTable
        rows={rows}
        selectedIds={selectedIds}
        onToggleSelection={onToggleSelection}
        onToggleAll={onToggleAll}
        allSelected={allSelected}
      />
      <div className="md:hidden space-y-2">
        {rows.map((r) => (
          <CustomersListCardMobile
            key={r.id}
            row={r}
            selectedIds={selectedIds}
            onToggleSelection={onToggleSelection}
            isSuperAdmin={isSuperAdmin}
          />
        ))}
      </div>
      <CustomersBulkSheet
        selectedIds={Array.from(selectedIds)}
        isSuperAdmin={isSuperAdmin}
        onClear={onClear}
      />
    </div>
  )
}
