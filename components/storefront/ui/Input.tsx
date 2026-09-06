'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/storefront/cn'

/**
 * Shared box for `<input>` and `<select>` (spec §5.2): 48px tall, sharp corners,
 * paper fill, strong hairline that turns danger-red while invalid.
 *
 * Exported so `Select` renders an identical control.
 */
export const fieldVariants = cva(
  [
    'h-12 w-full rounded-sharp border bg-paper px-4 text-sm text-ink',
    'placeholder:text-ink-mute',
    'transition-colors duration-sf-fast ease-sf-out',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
  ].join(' '),
  {
    variants: {
      invalid: {
        true: 'border-danger',
        false: 'border-line-strong',
      },
    },
    defaultVariants: {
      invalid: false,
    },
  }
)

export type FieldVariantProps = VariantProps<typeof fieldVariants>

/** Uppercase eyebrow label shared by every form primitive. */
export const fieldLabelClass =
  'text-xs font-semibold uppercase tracking-eyebrow text-ink-soft'

/** Hint copy under a field. */
export const fieldHintClass = 'text-xs text-ink-mute'

/** Error copy under a field. Always rendered in a live region. */
export const fieldErrorClass = 'text-xs font-medium text-danger'

/**
 * Joins the ids a field is described by, dropping the empty ones.
 * Returns `undefined` when there is nothing to describe.
 */
export function describedBy(...ids: (string | false | null | undefined)[]): string | undefined {
  const list = ids.filter((id): id is string => Boolean(id))
  return list.length > 0 ? list.join(' ') : undefined
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Visible (or screen-reader-only) label. Always required — no placeholder-only fields. */
  label: string
  /** Optional explicit id; one is generated with `useId` when omitted. */
  id?: string
  /** Validation message. Renders in `role="alert"` and marks the input invalid. */
  error?: string
  /** Helper copy rendered under the field and wired to `aria-describedby`. */
  hint?: string
  /** Keep the label in the accessibility tree but hide it visually. */
  hideLabel?: boolean
  /** Classes for the wrapping `<div>` (the `className` prop goes on the input). */
  wrapperClassName?: string
}

/** Labelled text input with hint/error slots (spec §5.2). */
export function Input({
  label,
  id: idProp,
  error,
  hint,
  hideLabel = false,
  className,
  wrapperClassName,
  'aria-describedby': ariaDescribedBy,
  ...props
}: InputProps) {
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
      <input
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(ariaDescribedBy, hint && hintId, error && errorId)}
        className={cn(fieldVariants({ invalid }), className)}
        {...props}
      />
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
