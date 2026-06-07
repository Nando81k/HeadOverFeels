'use client'

/**
 * TiersTab — tier card grid for the admin loyalty dashboard.
 *
 * Phase 7 Task 26 (Wave 5):
 *  - Props: tiers (TierRow[]), isSuperAdmin
 *  - Card grid: color swatch, name, minAnnualPoints threshold, pointMultiplier, perks pills, memberCount.
 *  - "+ New Tier" button → TierInspector in create mode.
 *  - Card click → getTierDetailForInspector(id) → TierInspector in edit mode.
 *  - No BulkSheet (tiers have no bulk actions).
 *  - No ExportButton (LoyaltyExportableTab does not include 'tiers').
 *  - No dark: Tailwind modifiers (V2 always-dark).
 */

import { useState, useTransition } from 'react'
import { TierInspector } from '@/components/admin/loyalty/inspectors/TierInspector'
import {
  getTierDetailForInspector,
  type TierDetailFull,
} from '@/app/admin/loyalty/actions'
import type { TierRow } from '@/lib/admin/loyalty'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TiersTabProps {
  tiers: TierRow[]
  isSuperAdmin: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nFmt = new Intl.NumberFormat('en-US')

// ─── Component ────────────────────────────────────────────────────────────────

export function TiersTab({ tiers, isSuperAdmin }: TiersTabProps) {
  const [open, setOpen] = useState(false)
  const [createMode, setCreateMode] = useState(false)
  const [detail, setDetail] = useState<TierDetailFull | null>(null)
  const [, startTransition] = useTransition()

  // ── Handlers ───────────────────────────────────────────────────────────────

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
      const d = await getTierDetailForInspector(id)
      setDetail(d)
    })
  }

  const handleClose = () => {
    setOpen(false)
    setDetail(null)
    setCreateMode(false)
  }

  const handleSaved = () => {
    handleClose()
  }

  const handleDeleted = () => {
    handleClose()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">
          {tiers.length} {tiers.length === 1 ? 'tier' : 'tiers'}
        </span>
        <button
          type="button"
          aria-label="New Tier"
          onClick={openCreate}
          className={[
            'text-xs px-3 py-1.5 rounded-md',
            'bg-[#FF3131] text-white hover:bg-[#ff4747]',
            'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
          ].join(' ')}
        >
          + New Tier
        </button>
      </div>

      {/* ── Card grid ──────────────────────────────────────────────────────── */}
      {tiers.length === 0 ? (
        <p className="text-sm text-white/30 text-center py-10">No tiers configured.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tiers.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => openCard(t.id)}
              className={[
                'text-left bg-neutral-900/60 border border-white/8',
                'rounded-xl p-4 hover:bg-white/[0.04] transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
              ].join(' ')}
            >
              {/* Name row with color swatch */}
              <div className="flex items-center gap-2 mb-3">
                {/* Primary + secondary color swatch */}
                <span
                  className="inline-flex items-center rounded-full overflow-hidden shrink-0"
                  style={{ width: 20, height: 20, background: `linear-gradient(135deg, ${t.primaryColor} 50%, ${t.secondaryColor} 50%)` }}
                  aria-hidden="true"
                />
                <span className="font-semibold text-sm text-white truncate">{t.name}</span>
                {!t.isActive && (
                  <span className="ml-auto text-[10px] text-white/40 shrink-0">(inactive)</span>
                )}
              </div>

              {/* Stats */}
              <div className="text-xs text-white/50 space-y-1 mb-3">
                <div>
                  <span className="text-white/30">Min pts: </span>
                  {nFmt.format(t.minAnnualPoints)}
                </div>
                <div>
                  <span className="text-white/30">Multiplier: </span>
                  {t.pointMultiplier}×
                </div>
                <div>
                  <span className="text-white/30">Members: </span>
                  {nFmt.format(t.memberCount)} members
                </div>
              </div>

              {/* Perk pills */}
              <div className="flex gap-1.5 flex-wrap">
                {t.freeShipping && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Free shipping
                  </span>
                )}
                {t.earlyDropAccess && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    Early drops
                  </span>
                )}
                {t.isInviteOnly && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">
                    Invite only
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── TierInspector ──────────────────────────────────────────────────── */}
      <TierInspector
        open={open}
        detail={detail}
        createMode={createMode}
        isSuperAdmin={isSuperAdmin}
        onClose={handleClose}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  )
}
