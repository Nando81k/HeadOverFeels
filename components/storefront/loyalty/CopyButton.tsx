'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/storefront/ui/Button'

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  /** What lands on the clipboard. */
  value: string
  /** Visible label before copying. Default "Copy". */
  label?: string
  /**
   * The read-only field holding `value`, for the no-clipboard fallback: its
   * text is selected so the visitor can copy by hand.
   */
  fallbackRef?: React.RefObject<HTMLInputElement | null>
}

const RESET_AFTER_MS = 2000

/**
 * Copies `value` through `navigator.clipboard`; without it (http, old
 * WebViews) the fallback field is selected instead. The label is a polite
 * live region so screen readers hear "Copied" (no `status` role: the banner
 * and the hero already own that role in their sections).
 */
export function CopyButton({
  value,
  label = 'Copy',
  fallbackRef,
  variant = 'outline',
  size = 'sm',
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), RESET_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleClick = async () => {
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    if (clipboard && typeof clipboard.writeText === 'function') {
      try {
        await clipboard.writeText(value)
        setCopied(true)
        return
      } catch {
        /* fall through to the selection fallback */
      }
    }
    const field = fallbackRef?.current
    if (field) {
      field.focus()
      field.select()
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleClick} {...props}>
      {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </Button>
  )
}
