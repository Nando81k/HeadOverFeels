'use client'

/**
 * EventInspector — full-CRUD slide-out drawer for a PointsMultiplierEvent.
 *
 * Phase 7 Task 11 (Wave 3):
 *  - Props: open, detail (EventDetailFull | null), createMode?, onClose, onSaved?, onDeleted?
 *  - Full CRUD: name, description, startDate, endDate, multiplier (Float, default 2.0),
 *    tierIds (JSON textarea — Phase 7.5 multi-select picker), categoryIds (JSON textarea),
 *    isActive checkbox.
 *  - Read-only stats: totalBonusPointsAwarded, ordersAffected (edit mode only).
 *  - createMode for "+ New Event"; editMode for existing events.
 *  - Delete button visible to all admins (no FK constraint on PointsMultiplierEvent).
 *  - window.confirm for delete.
 *  - Toast feedback via lib/toast.ts (Sonner).
 *  - No dark: Tailwind modifiers (V2 always-dark).
 *  - Vitest 1-arg generics.
 */

import { useEffect, useState, useTransition } from 'react'
import {
  createEvent,
  updateEvent,
  deleteEvent,
  type EventDetailFull,
} from '@/app/admin/loyalty/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventInspectorProps {
  /** Whether the drawer is open. */
  open: boolean
  /** Event to display and edit. `null` in createMode shows empty form. */
  detail: EventDetailFull | null
  /** When true, shows a blank form for creating a new event. */
  createMode?: boolean
  /** Called when the user dismisses the panel. */
  onClose: () => void
  /** Called after a successful save so the parent can refresh its list. */
  onSaved?: (id: string) => void
  /** Called after a successful delete so the parent can refresh its list. */
  onDeleted?: (id: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a Date to the `datetime-local` input format (UTC-based). */
function toDtLocal(d: Date | null | undefined): string {
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  )
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

const INPUT_CLS = [
  'w-full rounded-lg border border-white/10 bg-neutral-900/60',
  'px-3 py-2 text-sm text-white placeholder:text-white/25',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
].join(' ')

const LABEL_CLS = 'block text-xs font-medium uppercase tracking-wider text-white/50'

// ─── Component ────────────────────────────────────────────────────────────────

export function EventInspector({
  open,
  detail,
  createMode = false,
  onClose,
  onSaved,
  onDeleted,
}: EventInspectorProps) {
  const [pending, startTransition] = useTransition()

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [multiplier, setMultiplier] = useState(2.0)
  const [tierIds, setTierIds] = useState('')
  const [categoryIds, setCategoryIds] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Sync form state when drawer opens or detail changes
  useEffect(() => {
    if (!open) return
    if (detail) {
      setName(detail.name)
      setDescription(detail.description ?? '')
      setStartDate(toDtLocal(detail.startDate))
      setEndDate(toDtLocal(detail.endDate))
      setMultiplier(detail.multiplier)
      setTierIds(detail.tierIds ?? '')
      setCategoryIds(detail.categoryIds ?? '')
      setIsActive(detail.isActive)
    } else if (createMode) {
      setName('')
      setDescription('')
      setStartDate('')
      setEndDate('')
      setMultiplier(2.0)
      setTierIds('')
      setCategoryIds('')
      setIsActive(true)
    }
  }, [open, detail, createMode])

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSave() {
    const startDt = startDate ? new Date(startDate) : null
    const endDt = endDate ? new Date(endDate) : null

    if (!startDt || Number.isNaN(startDt.getTime())) {
      toast.error('A valid start date is required')
      return
    }
    if (!endDt || Number.isNaN(endDt.getTime())) {
      toast.error('A valid end date is required')
      return
    }

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        startDate: startDt,
        endDate: endDt,
        multiplier,
        tierIds: tierIds.trim() || null,
        categoryIds: categoryIds.trim() || null,
        isActive,
      }

      if (createMode || !detail) {
        const r = await createEvent(payload)
        if (r.ok) {
          toast.success('Event created')
          onSaved?.(r.data?.id ?? '')
          onClose()
        } else {
          toast.error((r as { ok: false; error: string }).error ?? 'Failed to create event')
        }
      } else {
        const r = await updateEvent(detail.id, payload)
        if (r.ok) {
          toast.success('Event saved')
          onSaved?.(detail.id)
          onClose()
        } else {
          toast.error((r as { ok: false; error: string }).error ?? 'Failed to save event')
        }
      }
    })
  }

  function handleDelete() {
    if (!detail) return
    if (!window.confirm(`Delete "${detail.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      const r = await deleteEvent(detail.id)
      if (r.ok) {
        toast.success('Event deleted')
        onDeleted?.(detail.id)
        onClose()
      } else {
        toast.error((r as { ok: false; error: string }).error ?? 'Failed to delete event')
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isEditMode = Boolean(detail && !createMode)
  const drawerTitle = isEditMode ? 'Edit Event' : 'New Event'

  return (
    <Inspector open={open} onClose={onClose} title={drawerTitle} width={460}>
      <div className="space-y-4 text-sm">

        {/* ── Name ────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="event-inspector-name" className={LABEL_CLS}>
            Name
          </label>
          <input
            id="event-inspector-name"
            aria-label="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            placeholder="e.g. Memorial Day 2× Points"
            className={[INPUT_CLS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          />
        </div>

        {/* ── Description ─────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="event-inspector-description" className={LABEL_CLS}>
            Description
          </label>
          <textarea
            id="event-inspector-description"
            aria-label="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={pending}
            rows={3}
            placeholder="Optional details about this event"
            className={[INPUT_CLS, 'resize-none', pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          />
        </div>

        {/* ── Dates ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="event-inspector-start-date" className={LABEL_CLS}>
              Starts
            </label>
            <input
              id="event-inspector-start-date"
              aria-label="Start date"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={pending}
              className={[INPUT_CLS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="event-inspector-end-date" className={LABEL_CLS}>
              Ends
            </label>
            <input
              id="event-inspector-end-date"
              aria-label="End date"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={pending}
              className={[INPUT_CLS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
            />
          </div>
        </div>

        {/* ── Multiplier ──────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="event-inspector-multiplier" className={LABEL_CLS}>
            Multiplier
          </label>
          <input
            id="event-inspector-multiplier"
            aria-label="Multiplier"
            type="number"
            min={1}
            step={0.1}
            value={multiplier}
            onChange={(e) => setMultiplier(Number(e.target.value))}
            disabled={pending}
            className={[INPUT_CLS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          />
        </div>

        {/* ── Tier IDs (Phase 7.5: multi-select picker) ───────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="event-inspector-tier-ids" className={LABEL_CLS}>
            Tier IDs{' '}
            <span className="normal-case font-normal text-white/30">
              (JSON array — blank = all tiers)
            </span>
          </label>
          <textarea
            id="event-inspector-tier-ids"
            aria-label="Tier IDs"
            value={tierIds}
            onChange={(e) => setTierIds(e.target.value)}
            disabled={pending}
            rows={2}
            placeholder='["tier-id-1", "tier-id-2"]'
            className={[INPUT_CLS, 'font-mono text-xs resize-none', pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          />
        </div>

        {/* ── Category IDs (Phase 7.5: multi-select picker) ───────────── */}
        <div className="space-y-1.5">
          <label htmlFor="event-inspector-category-ids" className={LABEL_CLS}>
            Category IDs{' '}
            <span className="normal-case font-normal text-white/30">
              (JSON array — blank = all categories)
            </span>
          </label>
          <textarea
            id="event-inspector-category-ids"
            aria-label="Category IDs"
            value={categoryIds}
            onChange={(e) => setCategoryIds(e.target.value)}
            disabled={pending}
            rows={2}
            placeholder='["cat-id-1", "cat-id-2"]'
            className={[INPUT_CLS, 'font-mono text-xs resize-none', pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          />
        </div>

        {/* ── Active toggle ────────────────────────────────────────────── */}
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

        {/* ── Read-only stats (edit mode only) ─────────────────────────── */}
        {detail && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div className="space-y-0.5">
              <div className="text-xs text-white/40 uppercase tracking-wider">
                Bonus pts awarded
              </div>
              <div className="text-white font-semibold tabular-nums">
                {detail.totalBonusPointsAwarded.toLocaleString()}
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-white/40 uppercase tracking-wider">
                Orders affected
              </div>
              <div className="text-white font-semibold tabular-nums">
                {detail.ordersAffected.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* ── Footer actions ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10">
          {/* Delete — visible in edit mode, no SUPER_ADMIN gate (no FK constraint) */}
          {detail && !createMode ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className={[
                'text-xs text-rose-400 hover:text-rose-300',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                'transition-colors',
                pending ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
            >
              Delete
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className={[
                'rounded-lg border border-white/10 px-4 py-2',
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
                'rounded-lg px-4 py-2',
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
      </div>
    </Inspector>
  )
}
