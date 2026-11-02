'use client'

import * as React from 'react'
import { useCart } from '@/components/storefront/cart/useCart'
import { fieldHintClass, fieldLabelClass } from '@/components/storefront/ui/Input'
import { cn } from '@/lib/storefront/cn'

/** Shopify caps `cart.note` well above this; 1000 matches the Server Action's schema. */
export const CART_NOTE_MAX_LENGTH = 1000

/** How long the "Saved" confirmation stays up. */
const SAVED_MS = 2000

export interface CartNoteFormProps {
  className?: string
}

/**
 * Order notes on the `/cart` page (Phase 3 plan, Task 7).
 *
 * Saves through `useCart().setNote` when the field loses focus and the value
 * changed since the last save — no save button, no per-keystroke requests.
 * The returned cart replaces provider state, so the saved note round-trips.
 * Failures surface through the provider's `error` (rendered by `CartPage`).
 */
export function CartNoteForm({ className }: CartNoteFormProps) {
  const { cart, setNote } = useCart()
  const id = React.useId()
  const hintId = `${id}-hint`

  const initial = cart?.note ?? ''
  const [value, setValue] = React.useState(initial)
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  /** Last value Shopify confirmed; compared against on blur. */
  const lastSaved = React.useRef(initial)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  async function save() {
    // The action trims; compare trimmed so trailing spaces never trigger a save.
    const next = value.trim()
    if (next === lastSaved.current.trim()) return

    setSaving(true)
    setSaved(false)
    const result = await setNote(next)
    setSaving(false)
    if (!result.ok) return

    lastSaved.current = result.cart.note ?? next
    setSaved(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setSaved(false), SAVED_MS)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)} data-cart-note>
      <label htmlFor={id} className={fieldLabelClass}>
        Order notes
      </label>
      <textarea
        id={id}
        name="note"
        rows={3}
        maxLength={CART_NOTE_MAX_LENGTH}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          void save()
        }}
        aria-describedby={hintId}
        aria-busy={saving || undefined}
        placeholder="Gift message, delivery instructions…"
        className={cn(
          'min-h-24 w-full resize-y rounded-sharp border border-line-strong bg-paper px-4 py-3 text-sm text-ink',
          'placeholder:text-ink-mute',
          'transition-colors duration-sf-fast ease-sf-out',
          'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
        )}
      />
      <div className="flex items-center justify-between gap-4">
        <p id={hintId} className={fieldHintClass}>
          Saved to your order when you leave the field.
        </p>
        <p role="status" className="num text-xs font-semibold uppercase tracking-eyebrow text-ink-soft">
          {saving ? 'Saving…' : saved ? 'Saved' : ''}
        </p>
      </div>
    </div>
  )
}
