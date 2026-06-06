'use client'

/**
 * GoalsInspector — slide-out drawer for editing the SalesGoals singleton.
 *
 * Phase 6 Task 14 (Wave 3):
 *  - Props: open, goals (SalesGoalsRow), onClose, onSaved?
 *  - 5 number inputs: dailyTarget, weeklyTarget, monthlyTarget, quarterlyTarget, yearlyTarget
 *  - Read-only "Last updated" timestamp display
 *  - Save calls updateSalesGoals (handles upsert + SalesGoalHistory inside $transaction)
 *  - Cancel button closes without saving
 *  - Toast feedback via lib/toast (Sonner)
 *  - No dark: Tailwind modifiers (V2 always-dark)
 */

import { useEffect, useState, useTransition } from 'react'
import type { SalesGoalsRow } from '@/app/admin/analytics/actions'
import { updateSalesGoals } from '@/app/admin/analytics/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoalsInspectorProps {
  /** Whether the drawer is open. */
  open: boolean
  /** SalesGoals singleton row to display and edit. */
  goals: SalesGoalsRow
  /** Called when the user dismisses the panel. */
  onClose: () => void
  /** Called after a successful save so the parent can refresh its data. */
  onSaved?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GoalsInspector({ open, goals, onClose, onSaved }: GoalsInspectorProps) {
  const [pending, startTransition] = useTransition()

  // Form state — initialised from props
  const [daily, setDaily] = useState(goals.dailyTarget)
  const [weekly, setWeekly] = useState(goals.weeklyTarget)
  const [monthly, setMonthly] = useState(goals.monthlyTarget)
  const [quarterly, setQuarterly] = useState(goals.quarterlyTarget)
  const [yearly, setYearly] = useState(goals.yearlyTarget)

  // Sync form state whenever the drawer opens or goals change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    setDaily(goals.dailyTarget)
    setWeekly(goals.weeklyTarget)
    setMonthly(goals.monthlyTarget)
    setQuarterly(goals.quarterlyTarget)
    setYearly(goals.yearlyTarget)
  }, [open, goals])
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSave() {
    startTransition(async () => {
      const r = await updateSalesGoals({
        dailyTarget: daily,
        weeklyTarget: weekly,
        monthlyTarget: monthly,
        quarterlyTarget: quarterly,
        yearlyTarget: yearly,
      })
      if (r.ok) {
        toast.success('Sales goals updated')
        onSaved?.()
        onClose()
      } else {
        toast.error((r as { ok: false; error: string }).error ?? 'Failed to save goals')
      }
    })
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const inputClass = [
    'w-full rounded-lg border border-white/10 bg-neutral-900/60',
    'px-3 py-2 text-sm text-white',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
    pending ? 'opacity-50 cursor-not-allowed' : '',
  ].join(' ')

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Inspector open={open} onClose={onClose} title="Edit Sales Goals" width={400}>
      <div className="space-y-4 text-sm">

        {/* ── Last updated (read-only) ──────────────────────────────── */}
        <p className="text-xs text-white/40">
          Last updated:{' '}
          <span className="text-white/60">
            {goals.updatedAt
              ? new Date(goals.updatedAt).toLocaleString()
              : 'never'}
          </span>
        </p>

        {/* ── Daily target ──────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label
            htmlFor="goals-inspector-daily"
            className="block text-xs font-medium uppercase tracking-wider text-white/50"
          >
            Daily target ($)
          </label>
          <input
            id="goals-inspector-daily"
            aria-label="Daily target"
            type="number"
            min={1}
            step={1}
            value={daily}
            onChange={(e) => setDaily(Number(e.target.value))}
            disabled={pending}
            className={inputClass}
          />
        </div>

        {/* ── Weekly target ─────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label
            htmlFor="goals-inspector-weekly"
            className="block text-xs font-medium uppercase tracking-wider text-white/50"
          >
            Weekly target ($)
          </label>
          <input
            id="goals-inspector-weekly"
            aria-label="Weekly target"
            type="number"
            min={1}
            step={1}
            value={weekly}
            onChange={(e) => setWeekly(Number(e.target.value))}
            disabled={pending}
            className={inputClass}
          />
        </div>

        {/* ── Monthly target ────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label
            htmlFor="goals-inspector-monthly"
            className="block text-xs font-medium uppercase tracking-wider text-white/50"
          >
            Monthly target ($)
          </label>
          <input
            id="goals-inspector-monthly"
            aria-label="Monthly target"
            type="number"
            min={1}
            step={1}
            value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))}
            disabled={pending}
            className={inputClass}
          />
        </div>

        {/* ── Quarterly target ──────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label
            htmlFor="goals-inspector-quarterly"
            className="block text-xs font-medium uppercase tracking-wider text-white/50"
          >
            Quarterly target ($)
          </label>
          <input
            id="goals-inspector-quarterly"
            aria-label="Quarterly target"
            type="number"
            min={1}
            step={1}
            value={quarterly}
            onChange={(e) => setQuarterly(Number(e.target.value))}
            disabled={pending}
            className={inputClass}
          />
        </div>

        {/* ── Yearly target ─────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label
            htmlFor="goals-inspector-yearly"
            className="block text-xs font-medium uppercase tracking-wider text-white/50"
          >
            Yearly target ($)
          </label>
          <input
            id="goals-inspector-yearly"
            aria-label="Yearly target"
            type="number"
            min={1}
            step={1}
            value={yearly}
            onChange={(e) => setYearly(Number(e.target.value))}
            disabled={pending}
            className={inputClass}
          />
        </div>

        {/* ── Footer actions ────────────────────────────────────────── */}
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
    </Inspector>
  )
}
