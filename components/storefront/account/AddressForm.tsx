'use client'

import * as React from 'react'
import { createAddressAction, updateAddressAction } from '@/app/(storefront)/_actions/account'
import { Button } from '@/components/storefront/ui/Button'
import { Checkbox } from '@/components/storefront/ui/Checkbox'
import { Input } from '@/components/storefront/ui/Input'
import { Select, type SelectOption } from '@/components/storefront/ui/Select'
import type { AccountActionResult, CustomerAddress } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

/**
 * Add / edit address form (Phase 4 plan, Task 5; mockup 05).
 *
 * A `useActionState` form over `createAddressAction` / `updateAddressAction`:
 * the field names match what the actions parse, a hidden `addressId` marks an
 * edit, and the action's `userErrors` message lands inline above the fields.
 * On success the action hands back the whole address list and `onSaved`
 * receives it — the book replaces its state wholesale, no refetch.
 */

export type AddressFormAction = (
  prev: AccountActionResult<CustomerAddress[]> | null,
  formData: FormData
) => Promise<AccountActionResult<CustomerAddress[]>>

/** Ship-to countries offered in the form; Shopify validates the rest. */
export const ADDRESS_COUNTRIES: SelectOption[] = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'JP', label: 'Japan' },
  { value: 'MX', label: 'Mexico' },
]

export interface AddressFormProps {
  /** The address to edit; omit to add a new one. */
  address?: CustomerAddress | null
  /** Defaults to the create or update Server Action depending on `address`. */
  action?: AddressFormAction
  /** Called with the full, fresh address list after a successful save. */
  onSaved?: (addresses: CustomerAddress[]) => void
  /** Renders a Cancel button when given. */
  onCancel?: () => void
  className?: string
}

export function AddressForm({ address = null, action, onSaved, onCancel, className }: AddressFormProps) {
  const editing = address !== null
  const resolvedAction = action ?? (editing ? updateAddressAction : createAddressAction)
  const [state, formAction, pending] = React.useActionState(resolvedAction, null)
  const formId = React.useId()

  // Fire `onSaved` once per successful result (not on every re-render).
  const handled = React.useRef<typeof state>(null)
  React.useEffect(() => {
    if (!state || handled.current === state) return
    handled.current = state
    if (state.ok) onSaved?.(state.data)
  }, [state, onSaved])

  const error = state && !state.ok ? state.error : null
  const title = editing ? 'Edit address' : 'Add address'
  const country = address?.territoryCode ?? 'US'
  const countries = ADDRESS_COUNTRIES.some((c) => c.value === country)
    ? ADDRESS_COUNTRIES
    : [...ADDRESS_COUNTRIES, { value: country, label: country }]

  return (
    <form
      action={formAction}
      aria-labelledby={`${formId}-title`}
      data-address-form={editing ? 'edit' : 'create'}
      className={cn('flex flex-col gap-4 rounded-sharp border border-line bg-paper p-5', className)}
    >
      <h3 id={`${formId}-title`} className="text-xs font-semibold uppercase tracking-eyebrow text-ink-mute">
        {title}
      </h3>

      {editing ? <input type="hidden" name="addressId" value={address.id} /> : null}

      {error ? (
        <p role="alert" className="border border-danger bg-paper px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="First name" name="firstName" autoComplete="given-name" defaultValue={address?.firstName ?? ''} />
        <Input label="Last name" name="lastName" autoComplete="family-name" defaultValue={address?.lastName ?? ''} />
      </div>
      <Input label="Company" name="company" autoComplete="organization" defaultValue={address?.company ?? ''} />
      <Input
        label="Address"
        name="address1"
        autoComplete="address-line1"
        required
        defaultValue={address?.address1 ?? ''}
      />
      <Input
        label="Apartment, suite, etc."
        name="address2"
        autoComplete="address-line2"
        defaultValue={address?.address2 ?? ''}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="City" name="city" autoComplete="address-level2" required defaultValue={address?.city ?? ''} />
        <Input
          label="State / province"
          name="zoneCode"
          autoComplete="address-level1"
          maxLength={10}
          hint="Two-letter code, e.g. NY"
          defaultValue={address?.zoneCode ?? ''}
        />
        <Input label="ZIP / postcode" name="zip" autoComplete="postal-code" required defaultValue={address?.zip ?? ''} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Country" name="territoryCode" autoComplete="country" options={countries} defaultValue={country} />
        <Input label="Phone" name="phone" type="tel" autoComplete="tel" defaultValue={address?.phone ?? ''} />
      </div>

      <Checkbox
        label="Make this my default address"
        name="defaultAddress"
        defaultChecked={address?.isDefault ?? false}
      />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" loading={pending}>
          Save address
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}
