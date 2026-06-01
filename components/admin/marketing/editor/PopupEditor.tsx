'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import {
  updatePopup,
  togglePopupActive,
  createPopupVariant,
  updatePopupVariant,
  deletePopupVariant,
} from '@/app/admin/marketing/actions'
import type { PopupDetailFull, PopupVariantDetail } from '@/app/admin/marketing/actions'

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMPLATES = ['MODAL', 'BANNER', 'SLIDE_IN', 'FULL_SCREEN', 'EMAIL_CAPTURE'] as const
const POSITIONS = ['TOP', 'BOTTOM', 'CENTER', 'BOTTOM_RIGHT', 'BOTTOM_LEFT', 'TOP_RIGHT', 'TOP_LEFT'] as const
const TRIGGERS = ['DELAY', 'SCROLL', 'EXIT_INTENT', 'IMMEDIATE'] as const
const FREQUENCIES = ['ONCE_PER_SESSION', 'ONCE_PER_DAY', 'ONCE_EVER', 'ALWAYS'] as const

type Template = (typeof TEMPLATES)[number]
type Position = (typeof POSITIONS)[number]
type Trigger = (typeof TRIGGERS)[number]
type Frequency = (typeof FREQUENCIES)[number]

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PopupEditorProps {
  detail: PopupDetailFull
  popupId: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalDate(d: Date | null): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {children}
    </section>
  )
}

// ─── Field label ──────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] uppercase text-white/40 mb-1">{children}</span>
  )
}

// ─── Input styles ─────────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-white/20'

const selectCls =
  'w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-white/20'

// ─── Component ───────────────────────────────────────────────────────────────

export function PopupEditor({ detail, popupId }: PopupEditorProps) {
  const [pending, startTransition] = useTransition()

  // Basics
  const [name, setName] = useState(detail.name)
  const [template, setTemplate] = useState<Template>(detail.template as Template)
  const [position, setPosition] = useState<Position>(detail.position as Position)

  // Trigger
  const [triggerType, setTriggerType] = useState<Trigger>(detail.triggerType as Trigger)
  const [triggerValue, setTriggerValue] = useState(detail.triggerValue)

  // Frequency
  const [frequency, setFrequency] = useState<Frequency>(detail.frequency as Frequency)

  // Content
  const [content, setContent] = useState(detail.content)
  const [variants, setVariants] = useState<PopupVariantDetail[]>(detail.variants)

  // Targeting
  const [showOnPages, setShowOnPages] = useState(detail.showOnPages)
  const [showToNewVisitors, setShowToNewVisitors] = useState(detail.showToNewVisitors)
  const [showToReturning, setShowToReturning] = useState(detail.showToReturning)

  // Schedule
  const [startDate, setStartDate] = useState(toLocalDate(detail.startDate))
  const [endDate, setEndDate] = useState(toLocalDate(detail.endDate))

  // Activation
  const [isActive, setIsActive] = useState(detail.isActive)
  const [priority, setPriority] = useState(detail.priority)

  // ─── Actions ───────────────────────────────────────────────────────────────

  function handleSave() {
    startTransition(async () => {
      const r = await updatePopup(popupId, {
        name,
        template,
        position,
        triggerType,
        triggerValue,
        frequency,
        content,
        showOnPages,
        showToNewVisitors,
        showToReturning,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive,
        priority,
      })
      if (r.ok) toast.success('Saved')
      else toast.error('Failed to save')
    })
  }

  function handleActivateToggle() {
    startTransition(async () => {
      const r = await togglePopupActive(popupId)
      if (r.ok) {
        setIsActive((prev) => !prev)
        toast.success(isActive ? 'Deactivated' : 'Activated')
      } else {
        toast.error('Failed')
      }
    })
  }

  function handleAddVariant() {
    startTransition(async () => {
      const r = await createPopupVariant(popupId, {
        name: 'New variant',
        weight: 50,
        isActive: true,
      })
      if (r.ok && r.data) {
        const now = new Date()
        setVariants((prev) => [
          ...prev,
          {
            id: r.data!.id,
            popupId,
            name: 'New variant',
            content: null,
            weight: 50,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
        ])
        toast.success('Variant added')
      } else {
        toast.error('Failed to add variant')
      }
    })
  }

  function handleSaveVariant(v: PopupVariantDetail) {
    startTransition(async () => {
      const r = await updatePopupVariant(v.id, {
        name: v.name,
        content: v.content,
        weight: v.weight,
        isActive: v.isActive,
      })
      if (r.ok) toast.success('Variant saved')
      else toast.error('Failed to save variant')
    })
  }

  function handleDeleteVariant(id: string) {
    if (!window.confirm('Delete this variant?')) return
    startTransition(async () => {
      const r = await deletePopupVariant(id)
      if (r.ok) {
        setVariants((prev) => prev.filter((v) => v.id !== id))
        toast.success('Variant deleted')
      } else {
        toast.error('Failed to delete')
      }
    })
  }

  function patchVariant(index: number, patch: Partial<PopupVariantDetail>) {
    setVariants((prev) =>
      prev.map((x, i) => (i === index ? { ...x, ...patch } : x)),
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const showTriggerValue = triggerType === 'DELAY' || triggerType === 'SCROLL'

  return (
    <div className="space-y-4">
      {/* 1. Basics */}
      <Section title="Basics">
        <label className="block">
          <FieldLabel>Name</FieldLabel>
          <input
            aria-label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label>
            <FieldLabel>Template</FieldLabel>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as Template)}
              className={selectCls}
            >
              {TEMPLATES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label>
            <FieldLabel>Position</FieldLabel>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as Position)}
              className={selectCls}
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      {/* 2. Trigger */}
      <Section title="Trigger">
        <label>
          <FieldLabel>Type</FieldLabel>
          <select
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as Trigger)}
            className={selectCls}
          >
            {TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        {showTriggerValue && (
          <label>
            <FieldLabel>
              {triggerType === 'DELAY' ? 'Delay (seconds)' : 'Scroll depth (%)'}
            </FieldLabel>
            <input
              type="number"
              value={triggerValue}
              onChange={(e) => setTriggerValue(Number(e.target.value))}
              className={inputCls}
            />
          </label>
        )}
      </Section>

      {/* 3. Frequency */}
      <Section title="Frequency">
        <label>
          <FieldLabel>Show frequency</FieldLabel>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className={selectCls}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
      </Section>

      {/* 4. Content */}
      <Section title="Content">
        <label className="block">
          <FieldLabel>Primary content (JSON)</FieldLabel>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-white/20"
          />
        </label>

        {/* A/B Variants sub-section */}
        <div className="pt-2 border-t border-white/8">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] uppercase text-white/40 font-medium">
              Variants (A/B)
            </h4>
            <button
              onClick={handleAddVariant}
              disabled={pending}
              className="text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-40"
            >
              + Add variant
            </button>
          </div>

          {variants.length === 0 && (
            <p className="text-xs text-white/40">
              No A/B variants. Add one to split traffic.
            </p>
          )}

          <ul className="space-y-2">
            {variants.map((v, i) => (
              <li
                key={v.id}
                className="bg-neutral-900 border border-white/8 rounded p-2 space-y-2"
              >
                <div className="grid grid-cols-3 gap-2 items-center">
                  {/* Variant name */}
                  <input
                    value={v.name}
                    onChange={(e) => patchVariant(i, { name: e.target.value })}
                    className="col-span-1 bg-neutral-900 border border-white/8 rounded px-2 py-1 text-white text-xs focus:outline-none"
                    placeholder="Name"
                  />

                  {/* Weight */}
                  <input
                    type="number"
                    value={v.weight}
                    onChange={(e) =>
                      patchVariant(i, { weight: Number(e.target.value) })
                    }
                    className="col-span-1 bg-neutral-900 border border-white/8 rounded px-2 py-1 text-white text-xs focus:outline-none"
                    placeholder="Weight"
                  />

                  {/* isActive */}
                  <label className="flex items-center gap-1.5 text-xs text-white/60 col-span-1">
                    <input
                      type="checkbox"
                      checked={v.isActive}
                      onChange={(e) =>
                        patchVariant(i, { isActive: e.target.checked })
                      }
                      className="accent-emerald-500"
                    />
                    Active
                  </label>
                </div>

                {/* Variant content */}
                <textarea
                  value={v.content ?? ''}
                  onChange={(e) => patchVariant(i, { content: e.target.value })}
                  rows={3}
                  className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none"
                  placeholder="Variant content (JSON)"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveVariant(v)}
                    disabled={pending}
                    className="text-xs px-2 py-1 bg-white/8 border border-white/15 rounded text-white disabled:opacity-40"
                  >
                    Save variant
                  </button>
                  <button
                    onClick={() => handleDeleteVariant(v.id)}
                    disabled={pending}
                    className="text-xs px-2 py-1 bg-rose-500/15 border border-rose-500/30 rounded text-rose-300 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 5. Targeting */}
      <Section title="Targeting">
        <label className="block">
          <FieldLabel>Show on pages (URL pattern or &quot;all&quot;)</FieldLabel>
          <input
            value={showOnPages}
            onChange={(e) => setShowOnPages(e.target.value)}
            className={inputCls}
            placeholder="all"
          />
        </label>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={showToNewVisitors}
              onChange={(e) => setShowToNewVisitors(e.target.checked)}
              className="accent-emerald-500"
            />
            New visitors
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={showToReturning}
              onChange={(e) => setShowToReturning(e.target.checked)}
              className="accent-emerald-500"
            />
            Returning visitors
          </label>
        </div>
      </Section>

      {/* 6. Schedule */}
      <Section title="Schedule">
        <div className="grid grid-cols-2 gap-2">
          <label>
            <FieldLabel>Starts</FieldLabel>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </label>
          <label>
            <FieldLabel>Ends</FieldLabel>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className={inputCls}
            />
          </label>
        </div>
      </Section>

      {/* 7. Activation */}
      <Section title="Activation">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={handleActivateToggle}
              className="accent-emerald-500"
            />
            Active
          </label>

          <label className="flex items-center gap-2 text-sm text-white/70">
            <span>Priority</span>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-16 bg-neutral-900 border border-white/8 rounded px-2 py-1 text-white text-sm focus:outline-none"
            />
          </label>
        </div>

        {/* Bottom action bar */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/8">
          <button
            onClick={handleSave}
            disabled={pending}
            className="px-3 py-1.5 text-sm bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded hover:bg-emerald-500/30 disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={handleActivateToggle}
            disabled={pending}
            className="px-3 py-1.5 text-sm bg-white/8 border border-white/15 rounded text-white hover:bg-white/15 disabled:opacity-40"
          >
            {isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </Section>
    </div>
  )
}
