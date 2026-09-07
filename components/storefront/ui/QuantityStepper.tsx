'use client'

import * as React from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/storefront/cn'
import { IconButton } from './IconButton'

const SIZE = {
  sm: { button: 'size-9 min-h-9 min-w-9', input: 'h-9 w-10 text-xs', icon: 'size-3.5' },
  md: { button: 'size-11 min-h-11 min-w-11', input: 'h-11 w-12 text-sm', icon: 'size-4' },
} as const

export type QuantityStepperSize = keyof typeof SIZE

export interface QuantityStepperProps {
  /** Current quantity. The component is fully controlled. */
  value: number
  /** Lower bound, inclusive. Decrement is disabled here. */
  min?: number
  /** Upper bound, inclusive (e.g. `custom.max_per_order` or stock). */
  max?: number
  /** Called with the clamped integer whenever the quantity changes. */
  onChange: (next: number) => void
  /** Accessible name for the group and the field. */
  label?: string
  size?: QuantityStepperSize
  className?: string
}

/** Clamp to the integer range; `NaN` falls back to `min`. */
function clamp(next: number, min: number, max?: number): number {
  if (!Number.isFinite(next)) return min
  const floored = Math.max(min, Math.floor(next))
  return typeof max === 'number' ? Math.min(floored, max) : floored
}

/**
 * Minus / number / plus quantity control (spec §5.2).
 *
 * While the field is focused the raw keystrokes are kept in `draft` so a user can
 * clear it and retype; every parse commits a clamped integer upward, and blur
 * discards the draft so the displayed number always mirrors `value`.
 */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label = 'Quantity',
  size = 'md',
  className,
}: QuantityStepperProps) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const sizes = SIZE[size]

  const commit = (raw: number) => {
    const next = clamp(raw, min, max)
    if (next !== value) onChange(next)
  }

  const step = (delta: number) => {
    setDraft(null)
    commit(value + delta)
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center rounded-sharp border border-line-strong bg-paper text-ink',
        className
      )}
    >
      <IconButton
        label="Decrease quantity"
        disabled={value <= min}
        onClick={() => step(-1)}
        className={sizes.button}
      >
        <Minus aria-hidden="true" className={sizes.icon} />
      </IconButton>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={label}
        value={draft ?? String(value)}
        onChange={(event) => {
          const raw = event.target.value
          setDraft(raw)
          if (raw.trim() === '') return
          commit(Number.parseInt(raw, 10))
        }}
        onBlur={() => {
          const raw = draft
          setDraft(null)
          if (raw !== null) commit(Number.parseInt(raw, 10))
        }}
        className={cn(
          'num border-x border-line bg-transparent text-center text-ink',
          'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:-outline-offset-2',
          sizes.input
        )}
      />
      <IconButton
        label="Increase quantity"
        disabled={typeof max === 'number' && value >= max}
        onClick={() => step(1)}
        className={sizes.button}
      >
        <Plus aria-hidden="true" className={sizes.icon} />
      </IconButton>
    </div>
  )
}
