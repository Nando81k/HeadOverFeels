'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import type { CartActionResult } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { Button } from '@/components/storefront/ui/Button'
import { Input } from '@/components/storefront/ui/Input'
import { useCart } from './useCart'

/**
 * A failure that belongs to the code the shopper typed (Shopify rejected it, or
 * the action handed the cart back after dropping a non-applicable code), as
 * opposed to a transport/unconfigured failure that the surrounding surface
 * reports generically.
 */
function isCodeError(result: CartActionResult): result is Extract<CartActionResult, { ok: false }> {
  return !result.ok && (Boolean(result.code) || Boolean(result.cart))
}

export interface DiscountCodeFormProps {
  /** Drawer layout: the field sits behind a "Have a code?" disclosure. */
  compact?: boolean
  className?: string
}

/**
 * Applied-code chips plus an Apply field. Loyalty rewards mint single-use
 * codes (Phase 4), so the same field takes both.
 *
 * A code-specific error is shown inline under the field (and taken out of the
 * shared cart message slot so it is not announced twice); anything else is
 * left in context for the drawer / page banner.
 */
export function DiscountCodeForm({ compact = false, className }: DiscountCodeFormProps) {
  const { cart, applyCode, removeCode, clearMessages } = useCart()
  const [code, setCode] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [codeError, setCodeError] = React.useState<string | null>(null)
  const codes = cart?.discountCodes ?? []

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = code.trim()
    if (!value || submitting) return
    setSubmitting(true)
    setCodeError(null)
    const result = await applyCode(value)
    setSubmitting(false)
    if (result.ok) {
      setCode('')
    } else if (isCodeError(result)) {
      setCodeError(result.error)
      clearMessages()
    }
  }

  const form = (
    <form onSubmit={onSubmit} noValidate className="flex items-start gap-2">
      <Input
        label="Discount code"
        hideLabel
        name="code"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder="Discount code"
        value={code}
        onChange={(event) => {
          setCode(event.target.value)
          if (codeError) setCodeError(null)
        }}
        error={codeError ?? undefined}
        wrapperClassName="min-w-0 flex-1"
        className="h-9"
      />
      <Button type="submit" variant="outline" size="sm" loading={submitting} disabled={!code.trim()}>
        Apply
      </Button>
    </form>
  )

  return (
    <div data-discount-form="" className={cn('flex flex-col gap-3', className)}>
      {codes.length > 0 ? (
        <ul aria-label="Discount codes" className="flex flex-wrap gap-2">
          {codes.map((entry) => (
            <li
              key={entry.code}
              className={cn(
                'inline-flex h-[26px] items-center gap-1 rounded-pill bg-rose-tint pl-2.5 pr-1 text-xs font-medium text-ink',
                !entry.applicable && 'text-ink-mute line-through'
              )}
            >
              <span className="num">{entry.code}</span>
              <button
                type="button"
                aria-label={`Remove discount ${entry.code}`}
                onClick={() => {
                  void removeCode(entry.code)
                }}
                className="inline-flex size-5 items-center justify-center rounded-pill text-ink-mute hover:text-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {compact ? (
        <details className="group">
          <summary className="cursor-pointer text-xs text-ink-mute underline underline-offset-[3px] hover:text-ink">
            Have a code?
          </summary>
          <div className="mt-3">{form}</div>
        </details>
      ) : (
        form
      )}
    </div>
  )
}
