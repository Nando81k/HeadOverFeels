'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/storefront/cn'
import { describedBy, fieldErrorClass, fieldHintClass } from './Input'

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Label text — this is the checkbox's accessible name. */
  label: React.ReactNode
  /** Optional explicit id; one is generated with `useId` when omitted. */
  id?: string
  /** Validation message. Renders in `role="alert"` and marks the input invalid. */
  error?: string
  /** Helper copy rendered under the label and wired to `aria-describedby`. */
  hint?: string
  /** Classes for the wrapping `<div>` (the `className` prop goes on the input). */
  wrapperClassName?: string
}

/**
 * Native checkbox, visually replaced by a token-styled box (spec §5.2).
 *
 * The real `<input>` stays in the DOM (`sr-only`, still focusable) and drives the
 * visual box through Tailwind `peer-*` variants, so keyboard, form submission and
 * the accessible name — taken from the surrounding `<label>` — are all native.
 */
export function Checkbox({
  label,
  id: idProp,
  error,
  hint,
  className,
  wrapperClassName,
  'aria-describedby': ariaDescribedBy,
  ...props
}: CheckboxProps) {
  const autoId = React.useId()
  const id = idProp ?? autoId
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const invalid = Boolean(error)

  return (
    <div className={cn('flex flex-col gap-2', wrapperClassName)}>
      <label
        htmlFor={id}
        className="inline-flex cursor-pointer items-start gap-3 text-sm text-ink select-none"
      >
        <input
          id={id}
          type="checkbox"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy(ariaDescribedBy, hint && hintId, error && errorId)}
          className={cn('peer sr-only', className)}
          {...props}
        />
        <span
          aria-hidden="true"
          data-checkbox-box=""
          className={cn(
            'mt-px flex size-5 shrink-0 items-center justify-center rounded-sharp border bg-paper text-bone',
            'transition-colors duration-sf-fast ease-sf-out',
            invalid ? 'border-danger' : 'border-line-strong',
            'peer-checked:border-ink peer-checked:bg-ink',
            // The tick lives inside the box, so it cannot use `peer-*` on its
            // own — the sibling variant is applied here and reaches the child.
            'peer-checked:[&_svg]:opacity-100',
            'peer-disabled:opacity-50',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-solid peer-focus-visible:outline-signal peer-focus-visible:outline-offset-2'
          )}
        >
          <Check
            className="size-3.5 opacity-0 transition-opacity duration-sf-fast ease-sf-out"
            strokeWidth={3}
          />
        </span>
        <span>{label}</span>
      </label>
      {hint ? (
        <p id={hintId} className={fieldHintClass}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className={fieldErrorClass}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
