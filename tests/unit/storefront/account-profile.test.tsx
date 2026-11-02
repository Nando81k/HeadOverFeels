// tests/unit/storefront/account-profile.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('server-only', () => ({}))

const { env, session, queries, accountActions } = vi.hoisted(() => ({
  env: { hasCustomerAccountEnv: vi.fn(() => true) },
  session: { requireFreshSession: vi.fn(), getCustomerSession: vi.fn() },
  queries: { getCustomerSummary: vi.fn() },
  accountActions: {
    getCustomerSummaryAction: vi.fn(),
    updateProfileAction: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/account/profile',
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

import ProfileRoute, { dynamic, metadata } from '@/app/(storefront)/account/profile/page'
import { CustomerProvider, type CustomerActions } from '@/components/storefront/account/CustomerProvider'
import { ProfileForm, type ProfileFormAction } from '@/components/storefront/account/ProfileForm'
import { normalizeCustomerSummary, type RawCustomerSummary } from '@/lib/shopify/customer/queries'
import type { CustomerSession } from '@/lib/shopify/customer/session'
import type { AccountActionResult, CustomerSummary } from '@/lib/shopify/types'
import customerFixture from '@/tests/fixtures/shopify/customer/customer.json'

const CUSTOMER: CustomerSummary = normalizeCustomerSummary(customerFixture as unknown as RawCustomerSummary)

const SESSION: CustomerSession = {
  tokens: { accessToken: 'token-1', refreshToken: 'rt', idToken: 'id', expiresAt: Date.now() + 3_600_000 },
  customerId: CUSTOMER.id,
  email: CUSTOMER.email,
  firstName: 'Nando',
  lastName: 'Alvarez',
}

function stubAction(result: AccountActionResult<CustomerSummary> | ((formData: FormData) => AccountActionResult<CustomerSummary>)) {
  return vi.fn<ProfileFormAction>(async (_prev, formData) =>
    typeof result === 'function' ? result(formData) : result
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  env.hasCustomerAccountEnv.mockReturnValue(true)
  session.requireFreshSession.mockResolvedValue(SESSION)
})

afterEach(() => {
  cleanup()
})

describe('ProfileForm', () => {
  it('prefills the names, keeps the email read-only and parks drop alerts', () => {
    render(<ProfileForm customer={CUSTOMER} action={stubAction({ ok: true, data: CUSTOMER })} />)

    expect(screen.getByLabelText('First name')).toHaveValue('Nando')
    expect(screen.getByLabelText('Last name')).toHaveValue('Alvarez')

    const email = screen.getByLabelText('Email')
    expect(email).toHaveValue('nando@example.com')
    expect(email).toHaveAttribute('readonly')
    expect(email).toHaveAccessibleDescription(/managed by your Shopify account/i)

    const alerts = screen.getByLabelText(/drop alerts/i)
    expect(alerts).toBeDisabled()
    expect(alerts).not.toBeChecked()
    expect(alerts).toHaveAttribute('title', expect.stringMatching(/phase 5/i))
  })

  it('submits the names to the action and confirms the save', async () => {
    const user = userEvent.setup()
    const seen: Record<string, FormDataEntryValue | null> = {}
    const action = stubAction((formData) => {
      seen.firstName = formData.get('firstName')
      seen.lastName = formData.get('lastName')
      seen.email = formData.get('email')
      return { ok: true, data: { ...CUSTOMER, firstName: 'Fernando', displayName: 'Fernando Alvarez' } }
    })
    render(<ProfileForm customer={CUSTOMER} action={action} />)

    const first = screen.getByLabelText('First name')
    await user.clear(first)
    await user.type(first, 'Fernando')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i)
    expect(seen).toMatchObject({ firstName: 'Fernando', lastName: 'Alvarez' })
    // The read-only email is not part of what the action receives.
    expect(seen.email).toBeNull()
    expect(screen.getByLabelText('First name')).toHaveValue('Fernando')
  })

  it('shows the action error inline', async () => {
    const user = userEvent.setup()
    render(
      <ProfileForm customer={CUSTOMER} action={stubAction({ ok: false, error: 'Enter your first and last name.', code: 'INVALID_INPUT' })} />
    )
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your first and last name.')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('refreshes the customer provider after a save so the header name follows', async () => {
    const user = userEvent.setup()
    const getSummary = vi.fn<CustomerActions['getSummary']>(async () => ({ status: 'ready', customer: CUSTOMER, loyalty: null }))
    render(
      <CustomerProvider actions={{ getSummary }}>
        <ProfileForm customer={CUSTOMER} action={stubAction({ ok: true, data: CUSTOMER })} />
      </CustomerProvider>
    )
    await waitFor(() => expect(getSummary).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByRole('status')
    await waitFor(() => expect(getSummary).toHaveBeenCalledTimes(2))
  })

  it('defaults to the update Server Action', async () => {
    const user = userEvent.setup()
    accountActions.updateProfileAction.mockResolvedValue({ ok: true, data: CUSTOMER })
    render(<ProfileForm customer={CUSTOMER} />)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(accountActions.updateProfileAction).toHaveBeenCalledTimes(1))
  })
})

describe('app/(storefront)/account/profile', () => {
  it('is dynamic and noindex', () => {
    expect(dynamic).toBe('force-dynamic')
    expect(metadata.robots).toMatchObject({ index: false })
  })

  it('reads the summary with the fresh token and renders the form', async () => {
    queries.getCustomerSummary.mockResolvedValue(CUSTOMER)
    render(await ProfileRoute())
    expect(session.requireFreshSession).toHaveBeenCalledWith('/account/profile')
    expect(queries.getCustomerSummary).toHaveBeenCalledWith('token-1')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Profile')
    expect(screen.getByLabelText('First name')).toHaveValue('Nando')
  })

  it('renders the gate when signed out', async () => {
    const { SignedOutError } = await import('@/lib/shopify/customer/errors')
    session.requireFreshSession.mockRejectedValue(new SignedOutError())
    render(await ProfileRoute())
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/account/login?return_to=%2Faccount%2Fprofile'
    )
  })
})
