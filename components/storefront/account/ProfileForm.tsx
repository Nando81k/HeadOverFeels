'use client'

import * as React from 'react'
import { updateProfileAction } from '@/app/(storefront)/_actions/account'
import { useCustomerOptional } from '@/components/storefront/account/CustomerProvider'
import { Button } from '@/components/storefront/ui/Button'
import { Checkbox } from '@/components/storefront/ui/Checkbox'
import { Input } from '@/components/storefront/ui/Input'
import type { AccountActionResult, CustomerSummary } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

/**
 * Profile form (Phase 4 plan, Task 5; mockup 06).
 *
 * Names post to `updateProfileAction` through `useActionState`; the email is
 * read-only because Shopify owns it (changing it is done on the hosted
 * account). The drop-alerts checkbox is display-only this phase — disabled,
 * titled "coming with Phase 5" — and nothing here writes to Prisma.
 *
 * After a save the layout's `CustomerProvider` is refreshed so the header
 * chip and greeting follow the new name without a reload.
 */

export type ProfileFormAction = (
  prev: AccountActionResult<CustomerSummary> | null,
  formData: FormData
) => Promise<AccountActionResult<CustomerSummary>>

export const DROP_ALERTS_TITLE = 'Drop alerts are coming with Phase 5'

export interface ProfileFormProps {
  customer: CustomerSummary
  /** Defaults to the Server Action. */
  action?: ProfileFormAction
  className?: string
}

export function ProfileForm({ customer, action = updateProfileAction, className }: ProfileFormProps) {
  const [state, formAction, pending] = React.useActionState(action, null)
  const account = useCustomerOptional()
  const refresh = account?.refresh

  const handled = React.useRef<typeof state>(null)
  React.useEffect(() => {
    if (!state || handled.current === state) return
    handled.current = state
    if (state.ok) void refresh?.()
  }, [state, refresh])

  const saved = state?.ok ? state.data : null
  const error = state && !state.ok ? state.error : null
  // After a save, the fresh names from the action win over the page's props.
  const firstName = saved?.firstName ?? customer.firstName ?? ''
  const lastName = saved?.lastName ?? customer.lastName ?? ''

  return (
    <form
      action={formAction}
      aria-label="Profile"
      className={cn('flex max-w-xl flex-col gap-5', className)}
    >
      {error ? (
        <p role="alert" className="border border-danger bg-paper px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="border border-line bg-paper px-4 py-3 text-sm text-ink">
          Saved. Your name is updated.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          key={`first-${firstName}`}
          label="First name"
          name="firstName"
          autoComplete="given-name"
          required
          maxLength={100}
          defaultValue={firstName}
        />
        <Input
          key={`last-${lastName}`}
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          required
          maxLength={100}
          defaultValue={lastName}
        />
      </div>

      <Input
        label="Email"
        type="email"
        value={customer.email}
        readOnly
        hint="Managed by your Shopify account."
        className="bg-bone text-ink-soft"
      />

      <Checkbox
        label="Drop alerts"
        name="dropAlerts"
        disabled
        defaultChecked={false}
        title={DROP_ALERTS_TITLE}
        hint="Be first to hear about drops — coming with Phase 5."
      />

      <div className="pt-2">
        <Button type="submit" loading={pending}>
          Save changes
        </Button>
      </div>
    </form>
  )
}
