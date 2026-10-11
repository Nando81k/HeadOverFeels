'use client'

import * as React from 'react'
import { deleteAddressAction } from '@/app/(storefront)/_actions/account'
import { AddressForm, type AddressFormAction } from '@/components/storefront/account/AddressForm'
import { Badge } from '@/components/storefront/ui/Badge'
import { Button } from '@/components/storefront/ui/Button'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import type { CustomerAddress } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

/**
 * Address cards and the book that owns them (Phase 4 plan, Task 5; mockup 05).
 *
 * `AddressCard` shows one address with its Default badge, an Edit button
 * (handled by the parent) and a small delete form (`useActionState` over
 * `deleteAddressAction`, which returns the remaining addresses).
 * `AddressBook` holds the list: add a new one, edit a card in place, drop one
 * — every change replaces the list with what the action returned.
 */

export interface AddressCardProps {
  address: CustomerAddress
  onEdit?: (address: CustomerAddress) => void
  /** Defaults to the delete Server Action. Omit `onDeleted` to hide the control. */
  deleteAction?: AddressFormAction
  onDeleted?: (addresses: CustomerAddress[]) => void
  className?: string
}

const CONTROL_CLASS = cn(
  'text-xs font-semibold uppercase tracking-eyebrow text-ink-soft underline underline-offset-4 decoration-line-strong',
  'transition-colors duration-sf-fast ease-sf-out hover:text-ink disabled:opacity-50',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
)

export function AddressCard({
  address,
  onEdit,
  deleteAction = deleteAddressAction,
  onDeleted,
  className,
}: AddressCardProps) {
  const [state, formAction, pending] = React.useActionState(deleteAction, null)
  const handled = React.useRef<typeof state>(null)
  React.useEffect(() => {
    if (!state || handled.current === state) return
    handled.current = state
    if (state.ok) onDeleted?.(state.data)
  }, [state, onDeleted])

  const error = state && !state.ok ? state.error : null
  const lines = address.formatted.length > 0 ? address.formatted : [address.address1 ?? ''].filter(Boolean)
  const labelId = React.useId()

  return (
    <article
      aria-labelledby={labelId}
      data-address-card=""
      data-default={address.isDefault ? '' : undefined}
      className={cn('flex flex-col gap-3 rounded-sharp border border-line bg-paper p-5', className)}
    >
      <div className="flex items-start justify-between gap-3">
        <address id={labelId} className="text-sm not-italic text-ink-soft">
          {lines.map((line, index) => (
            <span key={index} className={cn('block', index === 0 && 'font-semibold text-ink')}>
              {line}
            </span>
          ))}
        </address>
        {address.isDefault ? <Badge variant="drop">Default</Badge> : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        {onEdit ? (
          <button type="button" onClick={() => onEdit(address)} className={CONTROL_CLASS}>
            Edit
          </button>
        ) : null}
        <form action={formAction}>
          <input type="hidden" name="addressId" value={address.id} />
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
            className={CONTROL_CLASS}
          >
            {pending ? 'Deleting…' : 'Delete'}
          </button>
        </form>
      </div>
    </article>
  )
}

export interface AddressBookActions {
  create?: AddressFormAction
  update?: AddressFormAction
  delete?: AddressFormAction
}

export interface AddressBookProps {
  /** The addresses the page read with the fresh session. */
  initial: CustomerAddress[]
  /** Inject fakes (tests). Missing entries fall back to the Server Actions. */
  actions?: AddressBookActions
  className?: string
}

type Editing = { kind: 'none' } | { kind: 'new' } | { kind: 'edit'; id: string }

export function AddressBook({ initial, actions, className }: AddressBookProps) {
  const [addresses, setAddresses] = React.useState<CustomerAddress[]>(initial)
  const [editing, setEditing] = React.useState<Editing>({ kind: 'none' })

  const onSaved = React.useCallback((next: CustomerAddress[]) => {
    setAddresses(next)
    setEditing({ kind: 'none' })
  }, [])
  const onDeleted = React.useCallback((next: CustomerAddress[]) => setAddresses(next), [])
  const cancel = React.useCallback(() => setEditing({ kind: 'none' }), [])

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Eyebrow>Account</Eyebrow>
          <Display as="h1" size="md">
            Addresses
          </Display>
        </div>
        {editing.kind !== 'new' ? (
          <Button variant="outline" onClick={() => setEditing({ kind: 'new' })}>
            Add address
          </Button>
        ) : null}
      </header>

      {editing.kind === 'new' ? (
        <AddressForm action={actions?.create} onSaved={onSaved} onCancel={cancel} />
      ) : null}

      {addresses.length === 0 && editing.kind !== 'new' ? (
        <p className="text-sm text-ink-soft">No saved addresses yet. Add one to speed up checkout.</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {addresses.map((address) =>
          editing.kind === 'edit' && editing.id === address.id ? (
            <AddressForm
              key={address.id}
              address={address}
              action={actions?.update}
              onSaved={onSaved}
              onCancel={cancel}
              className="md:col-span-2"
            />
          ) : (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={(target) => setEditing({ kind: 'edit', id: target.id })}
              deleteAction={actions?.delete}
              onDeleted={onDeleted}
            />
          )
        )}
      </div>
    </div>
  )
}
