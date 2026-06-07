'use client'

/**
 * RewardInspector — quick-toggle Inspector for a single reward.
 *
 * Phase 7 Task 9 (Wave 3):
 *  - Props: open, detail (RewardDetailFull | null), onClose, onSaved
 *  - Quick-edit only: isActive switch, pointsCost number,
 *    maxRedemptionsPerCustomer number (nullable), minTierRequired text (slug).
 *  - "Edit details →" link to /admin/loyalty/rewards/[id]/edit (Task 31).
 *  - Save calls updateReward(id, payload).
 *  - Toast feedback via lib/toast.ts (Sonner).
 *  - No dark: Tailwind modifiers (V2 always-dark).
 */

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { updateReward } from '@/app/admin/loyalty/actions'
import type { RewardDetailFull } from '@/app/admin/loyalty/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RewardInspectorProps {
  /** Whether the drawer is open. */
  open: boolean
  /** Reward to display and quick-edit. `null` shows loading state. */
  detail: RewardDetailFull | null
  /** Called when the user dismisses the panel. */
  onClose: () => void
  /** Called after a successful save so the parent can refresh its list. */
  onSaved?: (id: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = [
  'w-full rounded-lg border border-white/10 bg-neutral-900/60',
  'px-3 py-2 text-sm text-white placeholder:text-white/25',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
].join(' ')

const labelCls = 'block text-xs font-medium uppercase tracking-wider text-white/50'

// ─── Component ────────────────────────────────────────────────────────────────

export function RewardInspector({
  open,
  detail,
  onClose,
  onSaved,
}: RewardInspectorProps) {
  const [pending, startTransition] = useTransition()

  // Form state
  const [isActive, setIsActive] = useState(true)
  const [pointsCost, setPointsCost] = useState(0)
  const [maxPerCustomer, setMaxPerCustomer] = useState<string>('')
  const [minTierRequired, setMinTierRequired] = useState('')

  // Sync form when detail changes
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!open || !detail) return
    setIsActive(detail.isActive)
    setPointsCost(detail.pointsCost)
    setMaxPerCustomer(detail.maxRedemptionsPerCustomer?.toString() ?? '')
    setMinTierRequired(detail.minTierRequired ?? '')
  }, [open, detail])
  /* eslint-enable react-hooks/exhaustive-deps */

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSave() {
    if (!detail) return
    startTransition(async () => {
      const r = await updateReward(detail.id, {
        isActive,
        pointsCost,
        maxRedemptionsPerCustomer: maxPerCustomer !== '' ? Number(maxPerCustomer) : null,
        minTierRequired: minTierRequired.trim() || null,
      })
      if (r.ok) {
        toast.success('Reward updated')
        onSaved?.(detail.id)
        onClose()
      } else {
        toast.error((r as { ok: false; error: string }).error ?? 'Failed to save')
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Inspector
      open={open}
      onClose={onClose}
      title="Reward (quick edit)"
      width={460}
    >
      {!detail ? (
        <p className="text-sm text-white/40 p-4">Loading…</p>
      ) : (
        <div className="space-y-4 text-sm">

          {/* ── Reward name (read-only) ──────────────────────────────── */}
          <div className="space-y-1">
            <div className={labelCls}>Name</div>
            <div className="font-medium text-white">{detail.name}</div>
          </div>

          {/* ── Reward type (read-only) ──────────────────────────────── */}
          <div className="space-y-1">
            <div className={labelCls}>Type</div>
            <div className="text-white/70">{detail.rewardType}</div>
          </div>

          {/* ── isActive toggle ──────────────────────────────────────── */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              aria-label="Active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={pending}
              className="h-4 w-4 accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="text-sm text-white/70">Active</span>
          </label>

          {/* ── Points cost ──────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label htmlFor="reward-inspector-points-cost" className={labelCls}>
              Points cost
            </label>
            <input
              id="reward-inspector-points-cost"
              aria-label="Points cost"
              type="number"
              min={0}
              step={1}
              value={pointsCost}
              onChange={(e) => setPointsCost(Number(e.target.value))}
              disabled={pending}
              className={[inputCls, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
            />
          </div>

          {/* ── Max redemptions per customer ─────────────────────────── */}
          <div className="space-y-1.5">
            <label htmlFor="reward-inspector-max-per-customer" className={labelCls}>
              Max per customer (blank = unlimited)
            </label>
            <input
              id="reward-inspector-max-per-customer"
              aria-label="Max redemptions per customer"
              type="number"
              min={0}
              step={1}
              value={maxPerCustomer}
              onChange={(e) => setMaxPerCustomer(e.target.value)}
              disabled={pending}
              placeholder="∞"
              className={[inputCls, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
            />
          </div>

          {/* ── Min tier required ────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label htmlFor="reward-inspector-min-tier" className={labelCls}>
              Min tier required (slug)
            </label>
            <input
              id="reward-inspector-min-tier"
              aria-label="Min tier required"
              type="text"
              value={minTierRequired}
              onChange={(e) => setMinTierRequired(e.target.value)}
              disabled={pending}
              placeholder="e.g. silver"
              className={[inputCls, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
            />
          </div>

          {/* ── Edit details link ────────────────────────────────────── */}
          <div className="pt-1 border-t border-white/10">
            <Link
              href={`/admin/loyalty/rewards/${detail.id}/edit`}
              className="text-xs text-[#FF3131] hover:text-[#e02020] transition-colors"
            >
              Edit details →
            </Link>
          </div>

          {/* ── Footer actions ───────────────────────────────────────── */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className={[
                'flex-1 rounded-lg border border-white/10 py-2',
                'text-sm font-medium text-white/60 hover:text-white/90',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className={[
                'flex-1 rounded-lg py-2',
                'text-sm font-semibold text-white',
                'bg-[#FF3131] hover:bg-[#e02020]',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </Inspector>
  )
}
