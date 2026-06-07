'use client'

import { useState, useTransition } from 'react'
import { MemberInspector } from '@/components/admin/loyalty/inspectors/MemberInspector'
import { MembersBulkSheet } from '@/components/admin/loyalty/bulk/MembersBulkSheet'
import { ExportButton } from '@/components/admin/loyalty/ExportButton'
import { getMemberDetailForInspector } from '@/app/admin/loyalty/actions'
import type { MemberDetailFull, TimeRange } from '@/app/admin/loyalty/actions'
import type { MemberRow } from '@/lib/admin/loyalty'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MembersTabData {
  items: MemberRow[]
  total: number
  page: number
  pageSize: number
}

export interface MembersTabProps {
  data: MembersTabData
  range: TimeRange
  isSuperAdmin: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nFmt = new Intl.NumberFormat('en-US')

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MembersTab({ data, range, isSuperAdmin }: MembersTabProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<MemberDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openRow = (id: string) => {
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getMemberDetailForInspector(id)
      setDetail(d)
    })
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">{nFmt.format(data.total)} members</span>
        <ExportButton tab="members" range={range} />
      </div>

      {/* Table */}
      <div className="bg-neutral-900/60 border border-white/8 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/[0.04] text-white/50 text-left">
            <tr>
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Current pts</th>
              <th className="px-3 py-2">Lifetime pts</th>
              <th className="px-3 py-2">Last order</th>
            </tr>
          </thead>
          <tbody className="text-white/80">
            {data.items.map((m) => (
              <tr
                key={m.id}
                className="border-t border-white/8 hover:bg-white/[0.04]"
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Select ${m.id}`}
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td
                  className="px-3 py-2 cursor-pointer"
                  onClick={() => openRow(m.id)}
                >
                  {m.email}
                </td>
                <td
                  className="px-3 py-2 cursor-pointer"
                  onClick={() => openRow(m.id)}
                >
                  {m.tierColor && (
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                      style={{ backgroundColor: m.tierColor }}
                    />
                  )}
                  {m.tierName ?? '—'}
                </td>
                <td
                  className="px-3 py-2 cursor-pointer tabular-nums"
                  onClick={() => openRow(m.id)}
                >
                  {nFmt.format(m.currentPoints)}
                </td>
                <td
                  className="px-3 py-2 cursor-pointer tabular-nums"
                  onClick={() => openRow(m.id)}
                >
                  {nFmt.format(m.lifetimePoints)}
                </td>
                <td
                  className="px-3 py-2 cursor-pointer"
                  onClick={() => openRow(m.id)}
                >
                  {formatDate(m.lastOrderDate)}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-white/30">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Inspector slide-out */}
      <MemberInspector
        open={open}
        detail={detail}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setOpen(false)}
      />

      {/* Bulk action sheet (visible when selection non-empty) */}
      <MembersBulkSheet
        selectedIds={Array.from(selected)}
        isSuperAdmin={isSuperAdmin}
        onClear={() => setSelected(new Set())}
      />
    </div>
  )
}
