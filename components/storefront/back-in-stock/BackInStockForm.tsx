'use client'

import * as React from 'react'
import { subscribeBackInStockAction } from '@/app/(storefront)/_actions/back-in-stock'
import { BACK_IN_STOCK_IDLE, type BackInStockFormState } from '@/lib/storefront/back-in-stock-form'
import { track } from '@/lib/storefront/analytics'
import { cn } from '@/lib/storefront/cn'
import { useCustomerOptional } from '@/components/storefront/account/useCustomer'
import { Button } from '@/components/storefront/ui/Button'
import { Input } from '@/components/storefront/ui/Input'
import { fieldErrorClass } from '@/components/storefront/ui/Input'

export const BACK_IN_STOCK_ID = 'back-in-stock'

export interface BackInStockFormProps {
  /** Shopify variant gid of the sold-out variant. */
  variantId: string
  handle: string
  /** "M / Black" — named in the heading. */
  variantTitle?: string | null
  /** Injectable for tests; defaults to the Server Action. */
  action?: (prev: BackInStockFormState, formData: FormData) => Promise<BackInStockFormState>
  /** Force the account email (otherwise read from `CustomerProvider`). */
  email?: string | null
  className?: string
}

export const BACK_IN_STOCK_SUCCESS = (email: string) => `Done — we'll email ${email} the moment it's back.`

/**
 * Sold-out variant → "Notify me when it's back" (Phase 5, Task 3). Signed-in
 * customers see a one-click button for their account email; guests get an
 * email field. Tracks `back_in_stock_subscribed` once on success.
 */
export function BackInStockForm({ variantId, handle, variantTitle, action = subscribeBackInStockAction, email, className }: BackInStockFormProps) {
  const customer = useCustomerOptional()
  const accountEmail = email ?? customer?.customer?.email ?? null
  const [state, formAction, pending] = React.useActionState(action, BACK_IN_STOCK_IDLE)
  const id = React.useId()

  React.useEffect(() => {
    if (state.status === 'success') track({ event: 'back_in_stock_subscribed', variantId })
  }, [state.status, variantId])

  const label = variantTitle && variantTitle !== 'Default Title' ? `Sold out in ${variantTitle}` : 'Sold out'

  if (state.status === 'success') {
    return (
      <p
        id={BACK_IN_STOCK_ID}
        role="status"
        data-back-in-stock="success"
        className={cn('rounded-sharp border border-line bg-paper p-4 text-sm text-ink-soft', className)}
      >
        {BACK_IN_STOCK_SUCCESS(state.email ?? accountEmail ?? 'you')}
      </p>
    )
  }

  return (
    <form
      id={BACK_IN_STOCK_ID}
      action={formAction}
      data-back-in-stock={accountEmail ? 'account' : 'guest'}
      aria-busy={pending || undefined}
      className={cn('flex flex-col gap-3 rounded-sharp border border-line bg-paper p-4', className)}
    >
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="handle" value={handle} />
      <div className="hidden" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-ink-soft">{label}</p>
        <p className="text-sm text-ink-soft">
          {accountEmail ? `We'll email ${accountEmail} when it's back.` : 'Leave your email and we’ll tell you the moment it’s back.'}
        </p>
      </div>

      {accountEmail ? (
        <input type="hidden" name="email" value={accountEmail} />
      ) : (
        <Input
          label="Email"
          hideLabel
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          defaultValue={state.values?.email ?? ''}
          error={state.status === 'error' && state.code === 'INVALID_EMAIL' ? state.error : undefined}
        />
      )}

      {state.status === 'error' && state.code !== 'INVALID_EMAIL' ? (
        <p role="alert" className={fieldErrorClass}>
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="outline" size="md" loading={pending}>
        Notify me when it’s back
      </Button>
    </form>
  )
}
