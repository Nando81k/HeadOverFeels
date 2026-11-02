'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/storefront/cn'
import {
  describedBy,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
  fieldVariants,
} from './Input'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Visible (or screen-reader-only) label. */
  label: string
  /** Optional explicit id; one is generated with `useId` when omitted. */
  id?: string
  /** Validation message. Renders in `role="alert"` and marks the select invalid. */
  error?: string
  /** Helper copy rendered under the field and wired to `aria-describedby`. */
  hint?: string
  /** Keep the label in the accessibility tree but hide it visually. */
  hideLabel?: boolean
  /** Convenience option list; when omitted, pass `<option>` children instead. */
  options?: SelectOption[]
  /** Classes for the wrapping `<div>` (the `className` prop goes on the select). */
  wrapperClassName?: string
}

/**
 * Native `<select>` restyled to the storefront field box (spec §5.2).
 * The chevron is decorative — the native control keeps all its behaviour.
 */
export function Select({
  label,
  id: idProp,
  error,
  hint,
  hideLabel = false,
  options,
  className,
  wrapperClassName,
  children,
  'aria-describedby': ariaDescribedBy,
  ...props
}: SelectProps) {
  const autoId = React.useId()
  const id = idProp ?? autoId
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const invalid = Boolean(error)

  return (
    <div className={cn('flex flex-col gap-2', wrapperClassName)}>
      <label htmlFor={id} className={cn(fieldLabelClass, hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy(ariaDescribedBy, hint && hintId, error && errorId)}
          className={cn(fieldVariants({ invalid }), 'appearance-none pr-10', className)}
          {...props}
        >
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink-mute"
        />
      </div>
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
