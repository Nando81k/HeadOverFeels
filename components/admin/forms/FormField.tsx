'use client'

import { Warning } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

interface FormFieldProps {
  /** Label text shown above the input. */
  label: string
  /** Mark the field as required (adds visual asterisk). Validation is the caller's responsibility. */
  required?: boolean
  /** Helper text under the input — secondary/muted, hidden when an error is present. */
  hint?: string
  /** Inline error message; when non-empty, renders below the input in error styling. */
  error?: string | null
  /** Optional id forwarded to label `htmlFor`; if omitted, callers should use a wrapping <label>. */
  htmlFor?: string
  /** Optional className applied to the wrapper. */
  className?: string
  /** The actual input/select/textarea/etc. */
  children: ReactNode
}

/**
 * Standard admin form field shell. Use it everywhere admin forms render
 * an input — that way label typography, spacing, hint, and inline error
 * affordances stay consistent across pages.
 *
 * The component is presentation-only: callers own state, validation, and
 * input-level event wiring. Pass `error` to render the warning state.
 *
 * Example:
 * ```tsx
 * <FormField label="Email" required error={errors.email}>
 *   <input
 *     id="email"
 *     type="email"
 *     value={email}
 *     onChange={(e) => setEmail(e.target.value)}
 *     className="w-full px-3 h-10 bg-neutral-950 border border-white/15 ..."
 *   />
 * </FormField>
 * ```
 */
export function FormField({
  label,
  required = false,
  hint,
  error,
  htmlFor,
  className = '',
  children,
}: FormFieldProps) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="block text-[10px] font-bold uppercase tracking-wider text-white/55 mb-1"
      >
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>

      {children}

      {error ? (
        <p className="mt-1 flex items-start gap-1 text-[11px] text-rose-300">
          <Warning size={11} weight="bold" className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-white/40">{hint}</p>
      ) : null}
    </div>
  )
}
