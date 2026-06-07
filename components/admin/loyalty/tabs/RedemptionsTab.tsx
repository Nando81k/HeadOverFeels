'use client'

import { useState, useTransition } from 'react'
import { RedemptionInspector } from '@/components/admin/loyalty/inspectors/RedemptionInspector'
import { RedemptionsBulkSheet } from '@/components/admin/loyalty/bulk/RedemptionsBulkSheet'
import { ExportButton } from '@/components/admin/loyalty/ExportButton'
import { getRedemptionDetailForInspector } from '@/app/admin/loyalty/actions'
import type { RedemptionDetailFull, TimeRange, RedemptionStatus } from '@/app/admin/loyalty/actions'
import type { RedemptionRow } from '@/lib/admin/loyalty'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RedemptionsTabData {
  items: RedemptionRow[]
  total: number
  page: number
  pageSize: number
}

export interface RedemptionsTabProps {
  data: RedemptionsTabData
  range: TimeRange
  isSuperAdmin: boolean
}

// ─── Status pill colours ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<RedemptionStatus, string> = {
  PENDING:   'bg-yellow-500/20 text-yellow-300',
  ACTIVE:    'bg-indigo-500/20 text-indigo-300',
  USED:      'bg-emerald-500/20 text-emerald-300',
  EXPIRED:   'bg-white/[0.04] text-white/40',
  CANCELLED: 'bg-red-500/20 text-red-300',
  FULFILLED: 'bg-purple-500/20 text-purple-300',
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RedemptionsTab({ data, range, isSuperAdmin }: RedemptionsTabProps) {
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [open, setOpen]             = useState(false)
  const [detail, setDetail]         = useState<RedemptionDetailFull | null>(null)
  const [, startTransition]         = useTransition()

  const openRow = (id: string) => {
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getRedemptionDetailForInspector(id)
      setDetail(d)
    })
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">{data.total} redemptions</span>
        <ExportButton tab="redemptions" range={range} />
      </div>

      {/* ── Audit table ───────────────────────────────────────────── */}
      <div className="bg-neutral-900/60 border border-white/8 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/[0.04] text-white/50 text-left">
            <tr>
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Reward</th>
              <th className="px-3 py-2">Points</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Coupon</th>
              <th className="px-3 py-2">Date</th>
            </tr>
          </thead>
          <tbody className="text-white/80">
            {data.items.map((r) => (
              <tr
                key={r.id}
                className="border-t border-white/8 hover:bg-white/[0.04] cursor-pointer"
                onClick={() => openRow(r.id)}
              >
                <td
                  className="px-3 py-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.id}`}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td className="px-3 py-2">{r.customerEmail}</td>
                <td className="px-3 py-2">{r.rewardName}</td>
                <td className="px-3 py-2">{r.pointsSpent.toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[r.status]}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[11px]">
                  {r.couponCode ?? '—'}
                </td>
                <td className="px-3 py-2">
                  {r.createdAt.toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Inspector slide-out ───────────────────────────────────── */}
      <RedemptionInspector
        open={open}
        detail={detail}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setOpen(false)}
      />

      {/* ── Bulk action sheet ─────────────────────────────────────── */}
      <RedemptionsBulkSheet
        selectedIds={Array.from(selected)}
        isSuperAdmin={isSuperAdmin}
        onClear={() => setSelected(new Set())}
      />
    </div>
  )
}
