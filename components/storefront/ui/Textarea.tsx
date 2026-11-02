'use client'

import * as React from 'react'
import { cn } from '@/lib/storefront/cn'
import { describedBy, fieldErrorClass, fieldHintClass, fieldLabelClass, fieldVariants } from './Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visible (or screen-reader-only) label. */
  label: string
  id?: string
  /** Validation message. Renders in `role="alert"` and marks the field invalid. */
  error?: string
  /** Helper copy wired to `aria-describedby`. */
  hint?: string
  hideLabel?: boolean
  wrapperClassName?: string
}

/** Labelled multi-line field sharing the `Input` box styling (spec §5.2). */
export function Textarea({
  label,
  id: idProp,
  error,
  hint,
  hideLabel = false,
  className,
  wrapperClassName,
  rows = 5,
  'aria-describedby': ariaDescribedBy,
  ...props
}: TextareaProps) {
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
      <textarea
        id={id}
        rows={rows}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(ariaDescribedBy, hint && hintId, error && errorId)}
        className={cn(fieldVariants({ invalid }), 'h-auto min-h-32 resize-y py-3 leading-relaxed', className)}
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
