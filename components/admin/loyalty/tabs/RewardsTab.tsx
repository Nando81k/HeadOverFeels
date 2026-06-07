'use client'

/**
 * RewardsTab — Phase 7 Wave 5 Task 27
 *
 * Card grid showing loyalty rewards with:
 *  - Image thumb, name, pointsCost, totalRedeemed, status pill, tier requirement
 *  - Card click → RewardInspector quick-toggle
 *  - "+ New Reward" link → /admin/loyalty/rewards/new
 *  - Checkbox selection → RewardsBulkSheet
 *  - ExportButton (tab="rewards") in header
 *
 * Props: { data: RewardsTabData, range: TimeRange }
 * No dark: Tailwind modifiers — V2 admin is always-dark.
 */

import Link from 'next/link'
import Image from 'next/image'
import { useState, useTransition } from 'react'
import { RewardInspector } from '@/components/admin/loyalty/inspectors/RewardInspector'
import { RewardsBulkSheet } from '@/components/admin/loyalty/bulk/RewardsBulkSheet'
import { ExportButton } from '@/components/admin/loyalty/ExportButton'
import { getRewardDetailForInspector } from '@/app/admin/loyalty/actions'
import type { RewardDetailFull, TimeRange } from '@/app/admin/loyalty/actions'
import type { RewardType } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RewardRow {
  id: string
  name: string
  slug: string
  pointsCost: number
  rewardType: RewardType
  isActive: boolean
  totalRedeemed: number
  maxRedemptionsPerCustomer: number | null
  totalAvailable: number | null
  minTierRequired: string | null
  sortOrder: number
  image: string | null
}

export interface RewardsTabData {
  items: RewardRow[]
  total: number
  page: number
  pageSize: number
}

export interface RewardsTabProps {
  data: RewardsTabData
  range: TimeRange
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nFmt = new Intl.NumberFormat('en-US')

// ─── Component ────────────────────────────────────────────────────────────────

export function RewardsTab({ data, range }: RewardsTabProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<RewardDetailFull | null>(null)
  const [, startTransition] = useTransition()

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openCard(id: string) {
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getRewardDetailForInspector(id)
      setDetail(d)
    })
  }

  function toggleSelect(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function clearSelection() {
    setSelected(new Set())
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Header: New Reward + Export ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin/loyalty/rewards/new"
          className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#e02020] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60"
        >
          + New Reward
        </Link>
        <ExportButton tab="rewards" range={range} />
      </div>

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {data.items.length === 0 && (
        <div className="py-16 text-center text-sm text-white/40">
          No rewards found.
        </div>
      )}

      {/* ── Card grid ───────────────────────────────────────────────── */}
      {data.items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.items.map((reward) => (
            <div
              key={reward.id}
              className="bg-neutral-900/60 border border-white/8 rounded-md p-3 hover:bg-white/[0.04] transition-colors"
            >
              {/* ── Card top: checkbox + image ────────────────────── */}
              <div className="flex items-start gap-2 mb-2">
                <input
                  type="checkbox"
                  aria-label={`Select ${reward.id}`}
                  checked={selected.has(reward.id)}
                  onChange={() => toggleSelect(reward.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 h-4 w-4 accent-[#FF3131] cursor-pointer flex-shrink-0"
                />

                {reward.image ? (
                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-white/[0.04]">
                    <Image
                      src={reward.image}
                      alt={reward.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded flex-shrink-0 bg-white/[0.04] flex items-center justify-center">
                    <span className="text-white/20 text-lg">🎁</span>
                  </div>
                )}

                {/* ── Name + type (clickable to open inspector) ──── */}
                <button
                  type="button"
                  onClick={() => openCard(reward.id)}
                  className="flex-1 min-w-0 text-left focus:outline-none focus-visible:underline"
                >
                  <div className="font-medium text-white text-sm leading-tight truncate">
                    {reward.name}
                  </div>
                  <div className="text-[10px] text-white/40 mt-0.5 truncate">
                    {reward.rewardType}
                  </div>
                </button>
              </div>

              {/* ── Stats ────────────────────────────────────────── */}
              <div className="text-xs text-white/60 space-y-1 ml-6">
                <div>
                  <span className="text-white/40">Cost:</span>{' '}
                  <span>{nFmt.format(reward.pointsCost)} pts</span>
                </div>
                <div>
                  <span className="text-white/40">Redeemed:</span>{' '}
                  <span>{nFmt.format(reward.totalRedeemed)}</span>
                </div>
                {reward.minTierRequired && (
                  <div>
                    <span className="text-white/40">Min tier:</span>{' '}
                    <span className="capitalize">{reward.minTierRequired}</span>
                  </div>
                )}
              </div>

              {/* ── Status pill ──────────────────────────────────── */}
              <div className="mt-2 ml-6">
                <span
                  className={[
                    'text-[10px] px-1.5 py-0.5 rounded',
                    reward.isActive
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/[0.04] text-white/40',
                  ].join(' ')}
                >
                  {reward.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination summary ──────────────────────────────────────── */}
      {data.total > data.pageSize && (
        <p className="text-xs text-white/40 text-center">
          Showing {data.items.length} of {nFmt.format(data.total)} rewards
        </p>
      )}

      {/* ── RewardInspector ─────────────────────────────────────────── */}
      <RewardInspector
        open={open}
        detail={detail}
        onClose={() => setOpen(false)}
      />

      {/* ── RewardsBulkSheet ─────────────────────────────────────────── */}
      <RewardsBulkSheet
        selectedIds={Array.from(selected)}
        onClear={clearSelection}
      />
    </div>
  )
}
