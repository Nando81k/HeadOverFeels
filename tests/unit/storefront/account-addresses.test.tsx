// tests/unit/storefront/account-addresses.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('server-only', () => ({}))

const { env, session, queries, accountActions } = vi.hoisted(() => ({
  env: { hasCustomerAccountEnv: vi.fn(() => true) },
  session: { requireFreshSession: vi.fn(), getCustomerSession: vi.fn() },
  queries: { getCustomerAddresses: vi.fn() },
  accountActions: {
    createAddressAction: vi.fn(),
    updateAddressAction: vi.fn(),
    deleteAddressAction: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/account/addresses',
  redirect: (...args: unknown[]) => {
    throw new Error(`NEXT_REDIRECT ${String(args[0])}`)
  },
}))
vi.mock('@/lib/shopify/customer/env', () => env)
vi.mock('@/lib/shopify/customer/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shopify/customer/session')>()
  return { ...actual, ...session }
})
vi.mock('@/lib/shopify/customer/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shopify/customer/queries')>()
  return { ...actual, ...queries }
})
vi.mock('@/app/(storefront)/_actions/account', () => accountActions)

import AddressesRoute, { dynamic, metadata } from '@/app/(storefront)/account/addresses/page'
import { AddressBook, AddressCard } from '@/components/storefront/account/AddressCard'
import { AddressForm, type AddressFormAction } from '@/components/storefront/account/AddressForm'
import { normalizeAddresses, type RawAddressesResponse } from '@/lib/shopify/customer/queries'
import type { CustomerSession } from '@/lib/shopify/customer/session'
import type { AccountActionResult, CustomerAddress } from '@/lib/shopify/types'
import addressesFixture from '@/tests/fixtures/shopify/customer/addresses.json'

const ADDRESSES: CustomerAddress[] = normalizeAddresses(addressesFixture as unknown as RawAddressesResponse)
const [HOME, STUDIO] = ADDRESSES

const SESSION: CustomerSession = {
  tokens: { accessToken: 'token-1', refreshToken: 'rt', idToken: 'id', expiresAt: Date.now() + 3_600_000 },
  customerId: 'gid://shopify/Customer/8123456789',
  email: 'nando@example.com',
  firstName: 'Nando',
  lastName: 'Alvarez',
}

type Result = AccountActionResult<CustomerAddress[]>

function stubAction(result: Result | ((formData: FormData) => Result)) {
  return vi.fn<AddressFormAction>(async (_prev, formData) =>
    typeof result === 'function' ? result(formData) : result
  )
}

/** The browser blocks a submit with empty `required` fields; fill the three. */
async function fillRequired(user: ReturnType<typeof userEvent.setup>, scope: ReturnType<typeof within>) {
  await user.type(scope.getByLabelText('Address'), '1 Main St')
  await user.type(scope.getByLabelText('City'), 'Austin')
  await user.type(scope.getByLabelText('ZIP / postcode'), '73301')
}

beforeEach(() => {
  vi.clearAllMocks()
  env.hasCustomerAccountEnv.mockReturnValue(true)
  session.requireFreshSession.mockResolvedValue(SESSION)
})

afterEach(() => {
  cleanup()
})

describe('AddressForm', () => {
  it('renders every field and posts the create action without an addressId', async () => {
    const user = userEvent.setup()
    const seen: Record<string, FormDataEntryValue | null> = {}
    const action = stubAction((formData) => {
      for (const key of ['addressId', 'firstName', 'address1', 'city', 'zoneCode', 'territoryCode', 'zip', 'defaultAddress']) {
        seen[key] = formData.get(key)
      }
      return { ok: true, data: ADDRESSES }
    })
    const onSaved = vi.fn()
    render(<AddressForm action={action} onSaved={onSaved} />)

    const form = screen.getByRole('form', { name: 'Add address' })
    expect(within(form).queryByDisplayValue(/gid:/)).toBeNull()

    await user.type(within(form).getByLabelText('First name'), 'Nando')
    await user.type(within(form).getByLabelText('Address'), '221 Bowery')
    await user.type(within(form).getByLabelText('City'), 'New York')
    await user.type(within(form).getByLabelText('State / province'), 'NY')
    await user.selectOptions(within(form).getByLabelText('Country'), 'US')
    await user.type(within(form).getByLabelText('ZIP / postcode'), '10012')
    await user.click(within(form).getByLabelText('Make this my default address'))
    await user.click(within(form).getByRole('button', { name: 'Save address' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(ADDRESSES))
    expect(action).toHaveBeenCalledTimes(1)
    expect(seen).toMatchObject({
      addressId: null,
      firstName: 'Nando',
      address1: '221 Bowery',
      city: 'New York',
      zoneCode: 'NY',
      territoryCode: 'US',
      zip: '10012',
      defaultAddress: 'on',
    })
  })

  it('prefills an existing address and carries its id in a hidden field', () => {
    render(<AddressForm address={STUDIO} action={stubAction({ ok: true, data: ADDRESSES })} />)
    const form = screen.getByRole('form', { name: 'Edit address' })
    const hidden = form.querySelector<HTMLInputElement>('input[name="addressId"]')
    expect(hidden).toHaveAttribute('type', 'hidden')
    expect(hidden).toHaveValue(STUDIO.id)
    expect(within(form).getByLabelText('Company')).toHaveValue('Head Over Feels Studio')
    expect(within(form).getByLabelText('Address')).toHaveValue('47 Greenpoint Ave')
    expect(within(form).getByLabelText('Country')).toHaveValue('US')
    expect(within(form).getByLabelText('Make this my default address')).not.toBeChecked()
  })

  it('shows the action error inline and does not call onSaved', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(
      <AddressForm
        action={stubAction({ ok: false, error: 'Zip is invalid for the selected country', code: 'INVALID' })}
        onSaved={onSaved}
      />
    )
    await fillRequired(user, within(screen.getByRole('form')))
    await user.click(screen.getByRole('button', { name: 'Save address' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Zip is invalid for the selected country')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('offers a cancel control when asked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<AddressForm action={stubAction({ ok: true, data: [] })} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('defaults to the create and update Server Actions', async () => {
    const user = userEvent.setup()
    accountActions.createAddressAction.mockResolvedValue({ ok: true, data: [] })
    accountActions.updateAddressAction.mockResolvedValue({ ok: true, data: [] })

    const { unmount } = render(<AddressForm />)
    await fillRequired(user, within(screen.getByRole('form')))
    await user.click(screen.getByRole('button', { name: 'Save address' }))
    await waitFor(() => expect(accountActions.createAddressAction).toHaveBeenCalledTimes(1))
    unmount()

    render(<AddressForm address={HOME} />)
    await user.click(screen.getByRole('button', { name: 'Save address' }))
    await waitFor(() => expect(accountActions.updateAddressAction).toHaveBeenCalledTimes(1))
  })
})

describe('AddressCard', () => {
  it('renders the formatted lines, the Default badge and edit/delete controls', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<AddressCard address={HOME} onEdit={onEdit} deleteAction={stubAction({ ok: true, data: [] })} />)

    const card = screen.getByRole('article', { name: /221 Bowery/ })
    expect(card).toHaveTextContent('Apt 4B')
    expect(within(card).getByText('Default')).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledWith(HOME)

    const del = within(card).getByRole('button', { name: /delete/i })
    expect(del.closest('form')?.querySelector('input[name="addressId"]')).toHaveValue(HOME.id)
  })

  it('has no Default badge on a non-default address', () => {
    render(<AddressCard address={STUDIO} />)
    expect(screen.queryByText('Default')).toBeNull()
  })

  it('reports the remaining addresses after a delete and shows its error inline', async () => {
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    const { unmount } = render(
      <AddressCard address={STUDIO} deleteAction={stubAction({ ok: true, data: [HOME] })} onDeleted={onDeleted} />
    )
    await user.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith([HOME]))
    unmount()

    render(
      <AddressCard
        address={STUDIO}
        deleteAction={stubAction({ ok: false, error: 'Default address cannot be deleted', code: 'INVALID' })}
      />
    )
    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Default address cannot be deleted')
  })
})

describe('AddressBook', () => {
  it('lists the addresses and toggles the add form', async () => {
    const user = userEvent.setup()
    render(<AddressBook initial={ADDRESSES} />)
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.queryByRole('form')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Add address' }))
    expect(screen.getByRole('form', { name: 'Add address' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('form')).toBeNull()
  })

  it('replaces the list with what the action returns after a create', async () => {
    const user = userEvent.setup()
    const create = stubAction({ ok: true, data: [HOME] })
    render(<AddressBook initial={[]} actions={{ create }} />)
    expect(screen.getByText(/no saved addresses/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add address' }))
    await fillRequired(user, within(screen.getByRole('form')))
    await user.click(screen.getByRole('button', { name: 'Save address' }))
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1))
    expect(screen.queryByRole('form')).toBeNull()
  })

  it('edits a card in place with the update action', async () => {
    const user = userEvent.setup()
    const update = stubAction({ ok: true, data: [{ ...HOME, city: 'Brooklyn' }, STUDIO] })
    render(<AddressBook initial={ADDRESSES} actions={{ update }} />)

    const home = screen.getByRole('article', { name: /221 Bowery/ })
    await user.click(within(home).getByRole('button', { name: /edit/i }))
    const form = screen.getByRole('form', { name: 'Edit address' })
    expect(within(form).getByLabelText('City')).toHaveValue('New York')
    expect(screen.getAllByRole('article')).toHaveLength(1)

    await user.click(within(form).getByRole('button', { name: 'Save address' }))
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
    expect(update).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('form')).toBeNull()
  })

  it('removes a card through the delete action', async () => {
    const user = userEvent.setup()
    const del = stubAction({ ok: true, data: [HOME] })
    render(<AddressBook initial={ADDRESSES} actions={{ delete: del }} />)
    const studio = screen.getByRole('article', { name: /Greenpoint/ })
    await user.click(within(studio).getByRole('button', { name: /delete/i }))
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1))
    expect(del).toHaveBeenCalledTimes(1)
  })
})

describe('app/(storefront)/account/addresses', () => {
  it('is dynamic and noindex', () => {
    expect(dynamic).toBe('force-dynamic')
    expect(metadata.robots).toMatchObject({ index: false })
  })

  it('reads the addresses with the fresh token and renders the book', async () => {
    queries.getCustomerAddresses.mockResolvedValue(ADDRESSES)
    render(await AddressesRoute())
    expect(session.requireFreshSession).toHaveBeenCalledWith('/account/addresses')
    expect(queries.getCustomerAddresses).toHaveBeenCalledWith('token-1')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Addresses')
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Add address' })).toBeInTheDocument()
  })

  it('renders the gate when signed out', async () => {
    const { SignedOutError } = await import('@/lib/shopify/customer/errors')
    session.requireFreshSession.mockRejectedValue(new SignedOutError())
    render(await AddressesRoute())
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/account/login?return_to=%2Faccount%2Faddresses'
    )
  })
})
