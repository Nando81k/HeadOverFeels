import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/storefront/ui/Button'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { cn } from '@/lib/storefront/cn'

export const ACCOUNT_UNAVAILABLE_TITLE = 'Sign-in is being set up'
export const ACCOUNT_UNAVAILABLE_MESSAGE =
  'Accounts will open as soon as the Shopify connection is live. Your Care Points are safe in the meantime.'

export interface AccountUnavailableProps {
  title?: string
  message?: string
  className?: string
}

/**
 * The HTTP-200 state of every account surface when `hasCustomerAccountEnv()`
 * is false (Phase 4 plan, cross-cutting note 5). `data-account="unconfigured"`
 * is the hook e2e uses to accept a page that has chrome but no account.
 */
export function AccountUnavailable({
  title = ACCOUNT_UNAVAILABLE_TITLE,
  message = ACCOUNT_UNAVAILABLE_MESSAGE,
  className,
}: AccountUnavailableProps) {
  return (
    <div
      data-account="unconfigured"
      role="status"
      className={cn('flex max-w-[42rem] flex-col items-start gap-4', className)}
    >
      <Eyebrow>Account</Eyebrow>
      <Display as="h1" size="md">
        {title}
      </Display>
      <p className="text-sm text-ink-soft">{message}</p>
      <Button asChild variant="outline">
        <Link href="/collections/all">Keep shopping</Link>
      </Button>
    </div>
  )
}
