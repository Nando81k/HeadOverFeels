'use client'

/**
 * PopupInspector — quick-edit slide-out panel for admin marketing popups.
 *
 * Renders a right-anchored Inspector drawer that:
 *  - Displays read-only popup metadata (name, analytics 7d, variant count)
 *  - Allows inline editing of:
 *      name, template, position, trigger + triggerValue,
 *      frequency, content textarea, isActive toggle
 *  - "Open editor →" link to /admin/marketing/popups/[id]/edit for
 *    A/B variants + scheduling
 *  - Submits via updatePopup / togglePopupActive server actions
 *  - Toast feedback via lib/toast.ts (Sonner)
 *
 * Phase 5 Task 6 — PopupInspector:
 *  Props: open, detail (PopupDetailFull | null), onClose, onSaved
 *  No dark: Tailwind modifiers (V2 always-dark).
 *
 * Schema adaptations vs spec:
 *  - triggerType field is named triggerType (not trigger) in schema;
 *    the select + input pair update both fields in one updatePopup call.
 *  - isActive toggle calls togglePopupActive(id, next) for atomic flip
 *    without a full-form submit; the full Save button also sends isActive.
 *  - analytics7d is read-only metadata shown in the header section.
 */

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import {
  updatePopup,
  togglePopupActive,
} from '@/app/admin/marketing/actions'
import type { PopupDetailFull } from '@/app/admin/marketing/actions'
import type {
  PopupTemplate,
  PopupPosition,
  PopupTrigger,
  PopupFrequency,
} from '@prisma/client'

// ─── Constants ────────────────────────────────────────────────────────────────

const POPUP_TEMPLATES: PopupTemplate[] = [
  'MODAL',
  'BANNER',
  'SLIDE_IN',
  'FULL_SCREEN',
  'EMAIL_CAPTURE',
]

const POPUP_POSITIONS: PopupPosition[] = [
  'TOP',
  'BOTTOM',
  'CENTER',
  'BOTTOM_RIGHT',
  'BOTTOM_LEFT',
  'TOP_RIGHT',
  'TOP_LEFT',
]

const POPUP_TRIGGERS: PopupTrigger[] = [
  'DELAY',
  'SCROLL',
  'EXIT_INTENT',
  'IMMEDIATE',
]

const POPUP_FREQUENCIES: PopupFrequency[] = [
  'ONCE_PER_SESSION',
  'ONCE_PER_DAY',
  'ONCE_EVER',
  'ALWAYS',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function labelForTemplate(t: PopupTemplate): string {
  const map: Record<PopupTemplate, string> = {
    MODAL: 'Modal',
    BANNER: 'Banner',
    SLIDE_IN: 'Slide-in',
    FULL_SCREEN: 'Full screen',
    EMAIL_CAPTURE: 'Email capture',
  }
  return map[t]
}

function labelForPosition(p: PopupPosition): string {
  const map: Record<PopupPosition, string> = {
    TOP: 'Top',
    BOTTOM: 'Bottom',
    CENTER: 'Center',
    BOTTOM_RIGHT: 'Bottom-right',
    BOTTOM_LEFT: 'Bottom-left',
    TOP_RIGHT: 'Top-right',
    TOP_LEFT: 'Top-left',
  }
  return map[p]
}

function labelForTrigger(t: PopupTrigger): string {
  const map: Record<PopupTrigger, string> = {
    DELAY: 'Delay (ms)',
    SCROLL: 'Scroll (%)',
    EXIT_INTENT: 'Exit intent',
    IMMEDIATE: 'Immediate',
  }
  return map[t]
}

function labelForFrequency(f: PopupFrequency): string {
  const map: Record<PopupFrequency, string> = {
    ONCE_PER_SESSION: 'Once per session',
    ONCE_PER_DAY: 'Once per day',
    ONCE_EVER: 'Once ever',
    ALWAYS: 'Always',
  }
  return map[f]
}

/** Returns true if the trigger needs a numeric value input. */
function triggerNeedsValue(t: PopupTrigger): boolean {
  return t === 'DELAY' || t === 'SCROLL'
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PopupInspectorProps {
  /** Whether the drawer is open. */
  open: boolean
  /** Popup to display and edit. `null` means the panel is closed or loading. */
  detail: PopupDetailFull | null
  /** Called when the user dismisses the panel. */
  onClose: () => void
  /** Called after a successful save so the parent can refresh its list. */
  onSaved?: (id: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PopupInspector({ open, detail, onClose, onSaved }: PopupInspectorProps) {
  const [pending, startTransition] = useTransition()

  // ── Form state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<PopupTemplate>('MODAL')
  const [position, setPosition] = useState<PopupPosition>('CENTER')
  const [triggerType, setTriggerType] = useState<PopupTrigger>('DELAY')
  const [triggerValue, setTriggerValue] = useState('')
  const [frequency, setFrequency] = useState<PopupFrequency>('ONCE_PER_SESSION')
  const [content, setContent] = useState('')
  const [isActive, setIsActive] = useState(false)

  // Sync form when detail changes.
  useEffect(() => {
    if (!detail) return
    setName(detail.name)
    setTemplate(detail.template)
    setPosition(detail.position)
    setTriggerType(detail.triggerType)
    setTriggerValue(String(detail.triggerValue))
    setFrequency(detail.frequency)
    setContent(detail.content)
    setIsActive(detail.isActive)
  }, [detail])

  // ── Handlers ───────────────────────────────────────────────────────────────

  /** Toggle isActive immediately without requiring Save. */
  function handleToggleActive() {
    const next = !isActive
    setIsActive(next)
    startTransition(async () => {
      const r = await togglePopupActive(detail!.id, next)
      if (r.ok) {
        toast.success(next ? 'Popup activated' : 'Popup deactivated')
        onSaved?.(detail!.id)
      } else {
        // Revert optimistic update on failure
        setIsActive(!next)
        toast.error((r as { ok: false; error: string }).error ?? 'Failed to toggle popup')
      }
    })
  }

  /** Save all editable fields via updatePopup. */
  function handleSave() {
    if (!detail) return

    const tv = parseFloat(triggerValue)
    const resolvedTriggerValue = triggerNeedsValue(triggerType)
      ? Number.isFinite(tv) ? tv : 0
      : 0

    startTransition(async () => {
      const r = await updatePopup(detail.id, {
        name: name.trim() || detail.name,
        template,
        position,
        triggerType,
        triggerValue: resolvedTriggerValue,
        frequency,
        content,
        isActive,
      })
      if (r.ok) {
        toast.success('Popup saved')
        onSaved?.(detail.id)
      } else {
        toast.error((r as { ok: false; error: string }).error ?? 'Failed to save popup')
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const selectCls = [
    'w-full rounded-lg border border-white/10 bg-neutral-900/60',
    'px-3 py-2 text-sm text-white',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
    pending ? 'opacity-50 cursor-not-allowed' : '',
  ].join(' ')

  const inputCls = [
    'w-full rounded-lg border border-white/10 bg-neutral-900/60',
    'px-3 py-2 text-sm text-white placeholder:text-white/25',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
    pending ? 'opacity-50 cursor-not-allowed' : '',
  ].join(' ')

  const labelCls = 'block text-xs font-medium uppercase tracking-wider text-white/50'

  return (
    <Inspector
      open={open}
      onClose={onClose}
      title={detail?.name ?? 'Popup Inspector'}
      width={440}
    >
      {detail && (
        <div className="space-y-5 text-sm">

          {/* ── Read-only analytics summary ──────────────────────────────── */}
          <section
            aria-label="Analytics summary"
            className="space-y-2 pb-4 border-b border-white/10"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">
              Last 7 days
            </p>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { label: 'Impr.', value: detail.analytics7d.impressions },
                  { label: 'Clicks', value: detail.analytics7d.clicks },
                  { label: 'Dismiss', value: detail.analytics7d.dismissals },
                  { label: 'Conv.', value: detail.analytics7d.conversions },
                ] as const
              ).map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg bg-white/5 px-2 py-2 text-center"
                >
                  <p className="text-base font-semibold text-white">{value}</p>
                  <p className="text-[10px] text-white/40">{label}</p>
                </div>
              ))}
            </div>
            {detail.variants.length > 0 && (
              <p className="text-xs text-white/40">
                {detail.variants.length} A/B variant{detail.variants.length !== 1 ? 's' : ''}
              </p>
            )}
          </section>

          {/* ── isActive toggle ───────────────────────────────────────────── */}
          <section className="flex items-center justify-between">
            <label
              htmlFor="popup-inspector-active"
              className="text-sm text-white/70 cursor-pointer select-none"
            >
              Active
            </label>
            <button
              id="popup-inspector-active"
              type="button"
              role="switch"
              aria-checked={isActive}
              aria-label="Toggle popup active"
              onClick={handleToggleActive}
              disabled={pending}
              className={[
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                'transition-colors duration-200 ease-in-out',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                isActive ? 'bg-emerald-500' : 'bg-white/20',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow',
                  'transition-transform duration-200 ease-in-out',
                  isActive ? 'translate-x-4' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </section>

          {/* ── Name ─────────────────────────────────────────────────────── */}
          <section className="space-y-1.5">
            <label htmlFor="popup-inspector-name" className={labelCls}>
              Name
            </label>
            <input
              id="popup-inspector-name"
              aria-label="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              className={inputCls}
            />
          </section>

          {/* ── Template ─────────────────────────────────────────────────── */}
          <section className="space-y-1.5">
            <label htmlFor="popup-inspector-template" className={labelCls}>
              Template
            </label>
            <select
              id="popup-inspector-template"
              aria-label="Template"
              value={template}
              onChange={(e) => setTemplate(e.target.value as PopupTemplate)}
              disabled={pending}
              className={selectCls}
            >
              {POPUP_TEMPLATES.map((t) => (
                <option key={t} value={t}>
                  {labelForTemplate(t)}
                </option>
              ))}
            </select>
          </section>

          {/* ── Position ─────────────────────────────────────────────────── */}
          <section className="space-y-1.5">
            <label htmlFor="popup-inspector-position" className={labelCls}>
              Position
            </label>
            <select
              id="popup-inspector-position"
              aria-label="Position"
              value={position}
              onChange={(e) => setPosition(e.target.value as PopupPosition)}
              disabled={pending}
              className={selectCls}
            >
              {POPUP_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {labelForPosition(p)}
                </option>
              ))}
            </select>
          </section>

          {/* ── Trigger ──────────────────────────────────────────────────── */}
          <section className="space-y-1.5">
            <p className={labelCls}>Trigger</p>
            <select
              id="popup-inspector-trigger"
              aria-label="Trigger"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as PopupTrigger)}
              disabled={pending}
              className={selectCls}
            >
              {POPUP_TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {labelForTrigger(t)}
                </option>
              ))}
            </select>
            {triggerNeedsValue(triggerType) && (
              <div className="space-y-1">
                <label htmlFor="popup-inspector-trigger-value" className="block text-xs text-white/40">
                  {triggerType === 'DELAY' ? 'Delay (ms)' : 'Scroll depth (%)'}
                </label>
                <input
                  id="popup-inspector-trigger-value"
                  aria-label="Trigger value"
                  type="number"
                  min={0}
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  disabled={pending}
                  className={inputCls}
                />
              </div>
            )}
          </section>

          {/* ── Frequency ────────────────────────────────────────────────── */}
          <section className="space-y-1.5">
            <label htmlFor="popup-inspector-frequency" className={labelCls}>
              Frequency
            </label>
            <select
              id="popup-inspector-frequency"
              aria-label="Frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as PopupFrequency)}
              disabled={pending}
              className={selectCls}
            >
              {POPUP_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {labelForFrequency(f)}
                </option>
              ))}
            </select>
          </section>

          {/* ── Content ──────────────────────────────────────────────────── */}
          <section className="space-y-1.5">
            <label htmlFor="popup-inspector-content" className={labelCls}>
              Content
            </label>
            <textarea
              id="popup-inspector-content"
              aria-label="Content"
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={pending}
              className={[
                'w-full rounded-lg border border-white/10 bg-neutral-900/60',
                'px-3 py-2 text-sm text-white placeholder:text-white/25 resize-y',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            />
          </section>

          {/* ── Save button ───────────────────────────────────────────────── */}
          <section className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className={[
                'flex-1 rounded-lg border border-white/10 py-2 text-sm font-medium text-white/60',
                'hover:text-white/90 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              data-testid="popup-inspector-save"
              className={[
                'flex-1 rounded-lg py-2 text-sm font-semibold text-white',
                'bg-[#FF3131] hover:bg-[#e02020] transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </section>

          {/* ── Open editor link ──────────────────────────────────────────── */}
          <div className="pt-2 border-t border-white/10">
            <Link
              href={`/admin/marketing/popups/${detail.id}/edit`}
              className="block text-center text-xs text-sky-300 hover:text-sky-200 underline underline-offset-2 transition-colors"
            >
              Open editor →
            </Link>
          </div>

        </div>
      )}
    </Inspector>
  )
}
