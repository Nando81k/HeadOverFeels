'use client'

/**
 * PromotionInspector — full-edit slide-out drawer for a single promotion.
 *
 * Phase 5 Task 5 (Wave 3):
 *  - Props: open, detail (PromotionDetailFull | null), onClose, onSaved
 *  - Full edit: name, type select (5 PromotionType values), value, code + Suggest
 *    button + on-blur uniqueness check, dates, min purchase, max uses total +
 *    per customer, isActive toggle (via togglePromotionActive), autoApply toggle.
 *  - Save calls updatePromotion(id, partial).
 *  - Suggest button calls suggestPromotionCode (no DB write; populates code field).
 *  - Code blur calls checkPromotionCodeUnique; shows "Taken" hint when not unique.
 *  - Toast feedback via lib/toast.ts (Sonner).
 *  - No dark: Tailwind modifiers (V2 always-dark).
 */

import { useEffect, useState, useTransition } from 'react'
import type { PromotionDetailFull } from '@/app/admin/marketing/actions'
import {
  updatePromotion,
  togglePromotionActive,
  suggestPromotionCode,
  checkPromotionCodeUnique,
} from '@/app/admin/marketing/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromotionInspectorProps {
  /** Whether the drawer is open. */
  open: boolean
  /** Promotion to display and edit. `null` shows loading state. */
  detail: PromotionDetailFull | null
  /** Called when the user dismisses the panel. */
  onClose: () => void
  /** Called after a successful save so the parent can refresh its list. */
  onSaved?: (id: string) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROMOTION_TYPES = [
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'FREE_SHIPPING',
  'BOGO',
  'BUY_X_GET_Y',
] as const

type PromotionType = typeof PROMOTION_TYPES[number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDate(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PromotionInspector({
  open,
  detail,
  onClose,
  onSaved,
}: PromotionInspectorProps) {
  const [pending, startTransition] = useTransition()

  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState<PromotionType>('PERCENTAGE')
  const [value, setValue] = useState(0)
  const [code, setCode] = useState('')
  const [codeTaken, setCodeTaken] = useState(false)
  const [minimumPurchase, setMinimumPurchase] = useState(0)
  const [maxUsesTotal, setMaxUsesTotal] = useState<number | ''>('')
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [autoApply, setAutoApply] = useState(false)

  // Sync form when detail changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!detail) return
    setName(detail.name)
    setType(detail.type as PromotionType)
    setValue(detail.value)
    setCode(detail.code ?? '')
    setCodeTaken(false)
    setMinimumPurchase(detail.minimumPurchase)
    setMaxUsesTotal(detail.maxUsesTotal ?? '')
    setMaxUsesPerCustomer(detail.maxUsesPerCustomer ?? '')
    setStartDate(toLocalDate(detail.startDate))
    setEndDate(toLocalDate(detail.endDate))
    setIsActive(detail.isActive)
    setAutoApply(detail.autoApply)
  }, [detail])
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSuggest() {
    startTransition(async () => {
      const r = await suggestPromotionCode()
      if (r.ok && r.data) {
        setCode(r.data.code)
        setCodeTaken(false)
      }
    })
  }

  function handleCheckCode() {
    const trimmed = code.trim()
    // Skip check if code is empty or unchanged from detail
    if (!trimmed || trimmed === (detail?.code ?? '')) return
    startTransition(async () => {
      const r = await checkPromotionCodeUnique(trimmed)
      if (r.ok && r.data) {
        setCodeTaken(!r.data.unique)
      }
    })
  }

  function handleToggleActive() {
    if (!detail) return
    startTransition(async () => {
      const r = await togglePromotionActive(detail.id)
      if (r.ok) {
        const nextActive = !isActive
        setIsActive(nextActive)
        toast.success(nextActive ? 'Activated' : 'Deactivated')
        onSaved?.(detail.id)
      } else {
        toast.error('Failed to update status')
      }
    })
  }

  function handleSave() {
    if (!detail) return
    startTransition(async () => {
      const r = await updatePromotion(detail.id, {
        name: name.trim(),
        type,
        value,
        code: code.trim() || null,
        minimumPurchase,
        maxUsesTotal: maxUsesTotal === '' ? null : Number(maxUsesTotal),
        maxUsesPerCustomer: maxUsesPerCustomer === '' ? null : Number(maxUsesPerCustomer),
        startDate: startDate ? new Date(startDate) : detail.startDate,
        endDate: endDate ? new Date(endDate) : null,
        isActive,
        autoApply,
      })
      if (r.ok) {
        toast.success('Promotion saved')
        onSaved?.(detail.id)
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
      title={detail?.name ?? 'Promotion'}
      width={440}
    >
      {!detail ? (
        <p className="text-sm text-white/40 p-4">Loading…</p>
      ) : (
        <div className="space-y-4 text-sm">

          {/* ── Name ─────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label
              htmlFor="promo-inspector-name"
              className="block text-xs font-medium uppercase tracking-wider text-white/50"
            >
              Name
            </label>
            <input
              id="promo-inspector-name"
              aria-label="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              className={[
                'w-full rounded-lg border border-white/10 bg-neutral-900/60',
                'px-3 py-2 text-sm text-white placeholder:text-white/25',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            />
          </div>

          {/* ── Type ─────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label
              htmlFor="promo-inspector-type"
              className="block text-xs font-medium uppercase tracking-wider text-white/50"
            >
              Type
            </label>
            <select
              id="promo-inspector-type"
              aria-label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as PromotionType)}
              disabled={pending}
              className={[
                'w-full rounded-lg border border-white/10 bg-neutral-900/60',
                'px-3 py-2 text-sm text-white',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {PROMOTION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* ── Value ────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label
              htmlFor="promo-inspector-value"
              className="block text-xs font-medium uppercase tracking-wider text-white/50"
            >
              Value
            </label>
            <input
              id="promo-inspector-value"
              aria-label="Value"
              type="number"
              min={0}
              step={0.01}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              disabled={pending}
              className={[
                'w-full rounded-lg border border-white/10 bg-neutral-900/60',
                'px-3 py-2 text-sm text-white',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            />
          </div>

          {/* ── Code + Suggest ───────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label
              htmlFor="promo-inspector-code"
              className="block text-xs font-medium uppercase tracking-wider text-white/50"
            >
              Code
            </label>
            <div className="flex gap-2">
              <input
                id="promo-inspector-code"
                aria-label="Code"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase())
                  setCodeTaken(false)
                }}
                onBlur={handleCheckCode}
                disabled={pending}
                placeholder="e.g. SUMMER20"
                className={[
                  'flex-1 rounded-lg border bg-neutral-900/60',
                  'px-3 py-2 text-sm text-white font-mono placeholder:text-white/25',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                  codeTaken ? 'border-rose-500/60' : 'border-white/10',
                  pending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
              <button
                type="button"
                onClick={handleSuggest}
                disabled={pending}
                className={[
                  'shrink-0 rounded-lg border border-white/10 px-3 py-2',
                  'text-xs font-medium text-white/60 hover:text-white/90',
                  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                  pending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                Suggest
              </button>
            </div>
            {codeTaken && (
              <p className="text-[11px] text-rose-300 mt-0.5">
                Taken — choose another code
              </p>
            )}
          </div>

          {/* ── Minimum purchase ─────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label
              htmlFor="promo-inspector-min-purchase"
              className="block text-xs font-medium uppercase tracking-wider text-white/50"
            >
              Minimum purchase ($)
            </label>
            <input
              id="promo-inspector-min-purchase"
              aria-label="Minimum purchase"
              type="number"
              min={0}
              step={0.01}
              value={minimumPurchase}
              onChange={(e) => setMinimumPurchase(Number(e.target.value))}
              disabled={pending}
              className={[
                'w-full rounded-lg border border-white/10 bg-neutral-900/60',
                'px-3 py-2 text-sm text-white',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            />
          </div>

          {/* ── Max uses ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="promo-inspector-max-uses-total"
                className="block text-xs font-medium uppercase tracking-wider text-white/50"
              >
                Max uses total
              </label>
              <input
                id="promo-inspector-max-uses-total"
                aria-label="Max uses total"
                type="number"
                min={0}
                value={maxUsesTotal}
                onChange={(e) =>
                  setMaxUsesTotal(e.target.value === '' ? '' : Number(e.target.value))
                }
                disabled={pending}
                placeholder="∞"
                className={[
                  'w-full rounded-lg border border-white/10 bg-neutral-900/60',
                  'px-3 py-2 text-sm text-white placeholder:text-white/25',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                  pending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="promo-inspector-max-uses-per-customer"
                className="block text-xs font-medium uppercase tracking-wider text-white/50"
              >
                Per customer
              </label>
              <input
                id="promo-inspector-max-uses-per-customer"
                aria-label="Max uses per customer"
                type="number"
                min={0}
                value={maxUsesPerCustomer}
                onChange={(e) =>
                  setMaxUsesPerCustomer(e.target.value === '' ? '' : Number(e.target.value))
                }
                disabled={pending}
                placeholder="∞"
                className={[
                  'w-full rounded-lg border border-white/10 bg-neutral-900/60',
                  'px-3 py-2 text-sm text-white placeholder:text-white/25',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                  pending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
            </div>
          </div>

          {/* ── Dates ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="promo-inspector-start-date"
                className="block text-xs font-medium uppercase tracking-wider text-white/50"
              >
                Starts
              </label>
              <input
                id="promo-inspector-start-date"
                aria-label="Start date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={pending}
                className={[
                  'w-full rounded-lg border border-white/10 bg-neutral-900/60',
                  'px-3 py-2 text-sm text-white',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                  pending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="promo-inspector-end-date"
                className="block text-xs font-medium uppercase tracking-wider text-white/50"
              >
                Ends
              </label>
              <input
                id="promo-inspector-end-date"
                aria-label="End date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={pending}
                className={[
                  'w-full rounded-lg border border-white/10 bg-neutral-900/60',
                  'px-3 py-2 text-sm text-white',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                  pending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
            </div>
          </div>

          {/* ── Toggles ──────────────────────────────────────────────── */}
          <div className="space-y-3 pt-1">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                aria-label="Active"
                checked={isActive}
                onChange={handleToggleActive}
                disabled={pending}
                className="h-4 w-4 accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="text-sm text-white/70">Active</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                aria-label="Auto-apply at checkout"
                checked={autoApply}
                onChange={(e) => setAutoApply(e.target.checked)}
                disabled={pending}
                className="h-4 w-4 accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="text-sm text-white/70">Auto-apply at checkout</span>
            </label>
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
              disabled={pending || codeTaken}
              className={[
                'flex-1 rounded-lg py-2',
                'text-sm font-semibold text-white',
                'bg-[#FF3131] hover:bg-[#e02020]',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                pending || codeTaken ? 'opacity-50 cursor-not-allowed' : '',
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
