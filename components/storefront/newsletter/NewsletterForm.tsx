'use client'

import * as React from 'react'
import { ArrowRight } from 'lucide-react'
import {
  subscribeNewsletterAction,
  type NewsletterState,
} from '@/app/(storefront)/_actions/newsletter'
import { Button } from '@/components/storefront/ui/Button'
import { Input } from '@/components/storefront/ui/Input'
import { cn } from '@/lib/storefront/cn'

export const NEWSLETTER_INITIAL_STATE: NewsletterState = { status: 'idle', message: '' }

export interface NewsletterFormProps {
  /** Injected in tests; defaults to the server action. */
  action?: typeof subscribeNewsletterAction
  className?: string
  /** Stack the field over the button — for narrow columns and drawers. */
  compact?: boolean
}

/**
 * Newsletter sign-up island (footer, home section).
 *
 * `useActionState` keeps the whole thing a progressive-enhancement form: it
 * posts to the server action with or without JS, and the returned
 * `NewsletterState` is the only thing rendered back. On success the fields are
 * replaced by the message — there is nothing left to submit.
 */
export function NewsletterForm({
  action = subscribeNewsletterAction,
  className,
  compact = false,
}: NewsletterFormProps) {
  const [state, formAction, pending] = React.useActionState(action, NEWSLETTER_INITIAL_STATE)
  const succeeded = state.status === 'success'

  return (
    <form action={formAction} className={cn('flex flex-col gap-3', className)}>
      {succeeded ? null : (
        <>
          <div className={cn('flex gap-2', compact ? 'flex-col' : 'items-end')}>
            <Input
              label="Email"
              hideLabel
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              wrapperClassName="flex-1"
            />
            <Button type="submit" variant="signal" loading={pending}>
              Join
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>

          {/* Honeypot: invisible to people, irresistible to bots. Hidden from
              the accessibility tree and skipped by the tab order, so only a
              script ever fills it in. */}
          <div aria-hidden="true">
            <input
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="sr-only"
            />
          </div>
        </>
      )}

      {state.message ? (
        succeeded ? (
          <p role="status" className="text-sm">
            {state.message}
          </p>
        ) : (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        )
      ) : null}
    </form>
  )
}
