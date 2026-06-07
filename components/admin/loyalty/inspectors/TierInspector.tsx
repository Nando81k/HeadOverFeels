'use client'

/**
 * TierInspector — full-CRUD slide-out drawer for a single loyalty tier.
 *
 * Phase 7 Task 8 (Wave 3):
 *  - Props: open, detail (TierDetailFull | null), createMode, isSuperAdmin, onClose, onSaved, onDeleted
 *  - Full CRUD: name, slug, description, primaryColor, secondaryColor,
 *    minAnnualSpend, minAnnualPoints, isInviteOnly, pointMultiplier,
 *    freeShipping, earlyDropAccess, perks (JSON textarea), sortOrder, isActive.
 *  - createMode => createTier; editMode => updateTier.
 *  - Delete button SUPER_ADMIN-gated (isSuperAdmin prop). Disabled with tooltip when false.
 *  - window.confirm before delete.
 *  - Toast feedback via lib/toast.ts (Sonner).
 *  - No dark: Tailwind modifiers (V2 always-dark).
 */

import { useEffect, useState, useTransition } from 'react'
import {
  createTier,
  updateTier,
  deleteTier,
  type TierDetailFull,
} from '@/app/admin/loyalty/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TierInspectorProps {
  /** Whether the drawer is open. */
  open: boolean
  /** Tier to display/edit. `null` in create mode or while loading. */
  detail: TierDetailFull | null
  /** When true, Save calls createTier instead of updateTier. */
  createMode?: boolean
  /** Controls whether the Delete button is enabled. */
  isSuperAdmin: boolean
  /** Called when the user dismisses the panel. */
  onClose: () => void
  /** Called after a successful create or update with the tier id. */
  onSaved?: (id: string) => void
  /** Called after a successful delete with the tier id. */
  onDeleted?: (id: string) => void
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const INPUT_CLS = [
  'w-full rounded-lg border border-white/10 bg-neutral-900/60',
  'px-3 py-2 text-sm text-white placeholder:text-white/25',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
].join(' ')

const LABEL_CLS = 'block text-xs font-medium uppercase tracking-wider text-white/50'

// ─── Component ────────────────────────────────────────────────────────────────

export function TierInspector({
  open,
  detail,
  createMode = false,
  isSuperAdmin,
  onClose,
  onSaved,
  onDeleted,
}: TierInspectorProps) {
  const [pending, startTransition] = useTransition()

  // ── Form state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#64748B')
  const [secondaryColor, setSecondaryColor] = useState('#475569')
  const [minAnnualSpend, setMinAnnualSpend] = useState(0)
  const [minAnnualPoints, setMinAnnualPoints] = useState(0)
  const [isInviteOnly, setIsInviteOnly] = useState(false)
  const [pointMultiplier, setPointMultiplier] = useState(1.0)
  const [freeShipping, setFreeShipping] = useState(false)
  const [earlyDropAccess, setEarlyDropAccess] = useState(false)
  const [perks, setPerks] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)

  // ── Sync form on open / detail change ─────────────────────────────────────
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    if (detail) {
      setName(detail.name)
      setSlug(detail.slug)
      setDescription(detail.description ?? '')
      setPrimaryColor(detail.primaryColor)
      setSecondaryColor(detail.secondaryColor)
      setMinAnnualSpend(detail.minAnnualSpend)
      setMinAnnualPoints(detail.minAnnualPoints)
      setIsInviteOnly(detail.isInviteOnly)
      setPointMultiplier(detail.pointMultiplier)
      setFreeShipping(detail.freeShipping)
      setEarlyDropAccess(detail.earlyDropAccess)
      setPerks(detail.perks ?? '')
      setSortOrder(detail.sortOrder)
      setIsActive(detail.isActive)
    } else if (createMode) {
      setName('')
      setSlug('')
      setDescription('')
      setPrimaryColor('#64748B')
      setSecondaryColor('#475569')
      setMinAnnualSpend(0)
      setMinAnnualPoints(0)
      setIsInviteOnly(false)
      setPointMultiplier(1.0)
      setFreeShipping(false)
      setEarlyDropAccess(false)
      setPerks('')
      setSortOrder(0)
      setIsActive(true)
    }
  }, [open, detail, createMode])
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSave() {
    startTransition(async () => {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        primaryColor,
        secondaryColor,
        minAnnualSpend,
        minAnnualPoints,
        isInviteOnly,
        pointMultiplier,
        freeShipping,
        earlyDropAccess,
        perks: perks.trim() || null,
        sortOrder,
        isActive,
      }

      if (createMode || !detail) {
        const r = await createTier(payload)
        if (r.ok) {
          toast.success('Tier created')
          onSaved?.(r.data?.id ?? '')
          onClose()
        } else {
          toast.error((r as { ok: false; error: string }).error ?? 'Failed to create tier')
        }
      } else {
        const r = await updateTier(detail.id, payload)
        if (r.ok) {
          toast.success('Tier updated')
          onSaved?.(detail.id)
          onClose()
        } else {
          toast.error((r as { ok: false; error: string }).error ?? 'Failed to update tier')
        }
      }
    })
  }

  function handleDelete() {
    if (!detail) return
    if (!window.confirm(`Delete "${detail.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      const r = await deleteTier(detail.id)
      if (r.ok) {
        toast.success('Tier deleted')
        onDeleted?.(detail.id)
        onClose()
      } else {
        toast.error((r as { ok: false; error: string }).error ?? 'Failed to delete tier')
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isEdit = !createMode && !!detail
  const title = isEdit ? `Edit Tier — ${detail.name}` : 'New Tier'

  return (
    <Inspector open={open} onClose={onClose} title={title} width={460}>
      <div className="space-y-4 text-sm">

        {/* ── Name ─────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="tier-inspector-name" className={LABEL_CLS}>
            Name
          </label>
          <input
            id="tier-inspector-name"
            aria-label="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            placeholder="e.g. Bronze"
            className={[INPUT_CLS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          />
        </div>

        {/* ── Slug ─────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="tier-inspector-slug" className={LABEL_CLS}>
            Slug
          </label>
          <input
            id="tier-inspector-slug"
            aria-label="slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            disabled={pending}
            placeholder="e.g. bronze"
            className={[
              INPUT_CLS,
              'font-mono',
              pending ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          />
        </div>

        {/* ── Description ──────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="tier-inspector-description" className={LABEL_CLS}>
            Description
          </label>
          <textarea
            id="tier-inspector-description"
            aria-label="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={pending}
            rows={2}
            placeholder="Short description of this tier's benefits"
            className={[INPUT_CLS, 'resize-none', pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          />
        </div>

        {/* ── Colors ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="tier-inspector-primary-color" className={LABEL_CLS}>
              Primary color
            </label>
            <div className="flex items-center gap-2">
              <input
                id="tier-inspector-primary-color"
                aria-label="primary color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                disabled={pending}
                className="h-9 w-10 cursor-pointer rounded border border-white/10 bg-neutral-900/60 p-0.5 disabled:cursor-not-allowed"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                disabled={pending}
                maxLength={7}
                className={[INPUT_CLS, 'font-mono text-xs', pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="tier-inspector-secondary-color" className={LABEL_CLS}>
              Secondary color
            </label>
            <div className="flex items-center gap-2">
              <input
                id="tier-inspector-secondary-color"
                aria-label="secondary color"
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                disabled={pending}
                className="h-9 w-10 cursor-pointer rounded border border-white/10 bg-neutral-900/60 p-0.5 disabled:cursor-not-allowed"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                disabled={pending}
                maxLength={7}
                className={[INPUT_CLS, 'font-mono text-xs', pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
              />
            </div>
          </div>
        </div>

        {/* ── Spend + Points thresholds ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="tier-inspector-min-spend" className={LABEL_CLS}>
              Min annual spend ($)
            </label>
            <input
              id="tier-inspector-min-spend"
              aria-label="min annual spend"
              type="number"
              min={0}
              step={0.01}
              value={minAnnualSpend}
              onChange={(e) => setMinAnnualSpend(Number(e.target.value))}
              disabled={pending}
              className={[INPUT_CLS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="tier-inspector-min-points" className={LABEL_CLS}>
              Min annual points
            </label>
            <input
              id="tier-inspector-min-points"
              aria-label="min annual points"
              type="number"
              min={0}
              step={1}
              value={minAnnualPoints}
              onChange={(e) => setMinAnnualPoints(Number(e.target.value))}
              disabled={pending}
              className={[INPUT_CLS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
            />
          </div>
        </div>

        {/* ── Point multiplier + Sort order ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="tier-inspector-point-multiplier" className={LABEL_CLS}>
              Point multiplier
            </label>
            <input
              id="tier-inspector-point-multiplier"
              aria-label="point multiplier"
              type="number"
              min={0.1}
              step={0.1}
              value={pointMultiplier}
              onChange={(e) => setPointMultiplier(Number(e.target.value))}
              disabled={pending}
              className={[INPUT_CLS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="tier-inspector-sort-order" className={LABEL_CLS}>
              Sort order
            </label>
            <input
              id="tier-inspector-sort-order"
              aria-label="sort order"
              type="number"
              step={1}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              disabled={pending}
              className={[INPUT_CLS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
            />
          </div>
        </div>

        {/* ── Boolean toggles ───────────────────────────────────────────── */}
        <div className="space-y-2.5 pt-1">
          {(
            [
              { id: 'free-shipping', label: 'Free shipping', checked: freeShipping, set: setFreeShipping },
              { id: 'early-drop-access', label: 'Early drop access', checked: earlyDropAccess, set: setEarlyDropAccess },
              { id: 'invite-only', label: 'Invite only', checked: isInviteOnly, set: setIsInviteOnly },
              { id: 'active', label: 'Active', checked: isActive, set: setIsActive },
            ] as const
          ).map(({ id, label, checked, set }) => (
            <label key={id} className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                aria-label={label}
                checked={checked}
                onChange={(e) => (set as (v: boolean) => void)(e.target.checked)}
                disabled={pending}
                className="h-4 w-4 accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="text-sm text-white/70">{label}</span>
            </label>
          ))}
        </div>

        {/* ── Perks JSON ────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="tier-inspector-perks" className={LABEL_CLS}>
            Perks (JSON)
          </label>
          <textarea
            id="tier-inspector-perks"
            aria-label="perks"
            value={perks}
            onChange={(e) => setPerks(e.target.value)}
            disabled={pending}
            rows={3}
            placeholder='{"careBox": true, "engravedItem": false}'
            className={[INPUT_CLS, 'resize-none font-mono text-xs', pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          />
        </div>

        {/* ── Footer actions ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10">
          {/* Delete — only rendered in edit mode */}
          {isEdit ? (
            <button
              type="button"
              aria-label="delete tier"
              disabled={!isSuperAdmin || pending}
              title={isSuperAdmin ? 'Delete this tier' : 'SUPER_ADMIN only'}
              onClick={handleDelete}
              className={[
                'text-xs font-medium text-rose-400 hover:text-rose-300',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60',
                !isSuperAdmin || pending ? 'opacity-40 cursor-not-allowed pointer-events-none' : '',
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
