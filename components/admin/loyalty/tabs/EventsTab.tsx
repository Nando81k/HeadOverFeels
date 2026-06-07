'use client'

import { useState, useTransition } from 'react'
import { EventInspector } from '@/components/admin/loyalty/inspectors/EventInspector'
import { EventsBulkSheet } from '@/components/admin/loyalty/bulk/EventsBulkSheet'
import { ExportButton } from '@/components/admin/loyalty/ExportButton'
import { getEventDetailForInspector } from '@/app/admin/loyalty/actions'
import type { EventDetailFull, TimeRange } from '@/app/admin/loyalty/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface EventRow {
  id: string
  name: string
  description: string | null
  startDate: Date
  endDate: Date
  multiplier: number
  isActive: boolean
  totalBonusPointsAwarded: number
  ordersAffected: number
}

export interface EventsTabData {
  items: EventRow[]
  total: number
  page: number
  pageSize: number
}

export interface EventsTabProps {
  data: EventsTabData
  range: TimeRange
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const nFmt = new Intl.NumberFormat('en-US')

type StatusLabel = 'active' | 'scheduled' | 'ended' | 'inactive'

interface StatusResult {
  label: StatusLabel
  cls: string
}

function statusOf(e: EventRow): StatusResult {
  if (!e.isActive) return { label: 'inactive', cls: 'bg-white/[0.04] text-white/40' }
  const now = Date.now()
  if (e.startDate.getTime() > now) return { label: 'scheduled', cls: 'bg-indigo-500/20 text-indigo-300' }
  if (e.endDate.getTime() < now) return { label: 'ended', cls: 'bg-white/[0.04] text-white/40' }
  return { label: 'active', cls: 'bg-emerald-500/20 text-emerald-300' }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function EventsTab({ data, range }: EventsTabProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [createMode, setCreateMode] = useState(false)
  const [detail, setDetail] = useState<EventDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openCreate = () => {
    setDetail(null)
    setCreateMode(true)
    setOpen(true)
  }

  const openCard = (id: string) => {
    setCreateMode(false)
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getEventDetailForInspector(id)
      setDetail(d)
    })
  }

  const toggleSelected = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleClose = () => setOpen(false)
  const handleClear = () => setSelected(new Set())

  return (
    <div className="space-y-4">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={openCreate}
          className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#e02020] transition-colors"
        >
          + New Event
        </button>
        <ExportButton tab="events" range={range} />
      </div>

      {/* ── Card grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.items.map((e) => {
          const s = statusOf(e)
          const isSelected = selected.has(e.id)
          return (
            <div
              key={e.id}
              className={[
                'bg-neutral-900/60 border rounded-md p-3 transition-colors',
                isSelected ? 'border-[#FF3131]/40' : 'border-white/8',
                'hover:bg-white/[0.04]',
              ].join(' ')}
            >
              {/* Card header */}
              <div className="flex items-start gap-2 mb-2">
                <input
                  type="checkbox"
                  aria-label={`Select ${e.name}`}
                  checked={isSelected}
                  onChange={() => toggleSelected(e.id)}
                  onClick={(ev) => ev.stopPropagation()}
                  className="mt-0.5 h-3.5 w-3.5 accent-[#FF3131] cursor-pointer flex-shrink-0"
                />
                <button
                  type="button"
                  onClick={() => openCard(e.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="font-medium text-white text-sm truncate">{e.name}</div>
                  <div className="text-xs text-white/40">{e.multiplier}× multiplier</div>
                </button>
                <span
                  className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${s.cls}`}
                >
                  {s.label}
                </span>
              </div>

              {/* Card body */}
              <div className="text-xs text-white/50 space-y-1 ml-5">
                <div>
                  {e.startDate.toLocaleDateString()} → {e.endDate.toLocaleDateString()}
                </div>
                <div>{nFmt.format(e.totalBonusPointsAwarded)} bonus pts</div>
                <div>{nFmt.format(e.ordersAffected)} orders affected</div>
              </div>
            </div>
          )
        })}

        {data.items.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-white/30">
            No events found.
          </div>
        )}
      </div>

      {/* ── Inspector ────────────────────────────────────────────────────── */}
      <EventInspector
        open={open}
        detail={detail}
        createMode={createMode}
        onClose={handleClose}
      />

      {/* ── Bulk action sheet ─────────────────────────────────────────────── */}
      <EventsBulkSheet
        selectedIds={Array.from(selected)}
        onClear={handleClear}
      />
    </div>
  )
}
