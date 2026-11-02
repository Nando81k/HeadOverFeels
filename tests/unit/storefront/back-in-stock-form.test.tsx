// tests/unit/storefront/back-in-stock-form.test.tsx — BackInStockForm + unsubscribe page
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('server-only', () => ({}))
vi.mock('@/app/(storefront)/_actions/back-in-stock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(storefront)/_actions/back-in-stock')>()
  return { ...actual, subscribeBackInStockAction: vi.fn() }
})
const customerState = vi.hoisted(() => ({ current: null as null | { status: string; customer: { email: string } | null } }))
vi.mock('@/components/storefront/account/useCustomer', () => ({ useCustomerOptional: () => customerState.current }))
const lib = vi.hoisted(() => ({ cancelSubscription: vi.fn() }))
vi.mock('@/lib/storefront/back-in-stock', () => lib)

import type { BackInStockFormState } from '@/lib/storefront/back-in-stock-form'
import UnsubscribePage, { dynamic } from '@/app/(storefront)/back-in-stock/unsubscribe/page'
import { BackInStockForm } from '@/components/storefront/back-in-stock/BackInStockForm'
import { onAnalyticsEvent } from '@/lib/storefront/analytics'

const VARIANT = 'gid://shopify/ProductVariant/46601236185313'

beforeEach(() => {
  vi.clearAllMocks()
  customerState.current = { status: 'signed-out', customer: null }
})
afterEach(cleanup)

describe('BackInStockForm', () => {
  it('asks a guest for an email and shows the confirmation; tracks the event', async () => {
    const action = vi.fn(async (_prev: BackInStockFormState, formData: FormData): Promise<BackInStockFormState> => {
      expect(formData.get('variantId')).toBe(VARIANT)
      expect(formData.get('handle')).toBe('core-hoodie')
      expect(formData.get('email')).toBe('guest@example.com')
      return { status: 'success', email: 'guest@example.com' }
    })
    const events: unknown[] = []
    const off = onAnalyticsEvent((event) => events.push(event))

    render(<BackInStockForm variantId={VARIANT} handle="core-hoodie" variantTitle="S / Black" action={action} />)
    expect(document.getElementById('back-in-stock')).toHaveAttribute('data-back-in-stock', 'guest')
    expect(screen.getByText('Sold out in S / Black')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Email'), 'guest@example.com')
    await userEvent.click(screen.getByRole('button', { name: /notify me/i }))

    expect(await screen.findByRole('status')).toHaveTextContent("we'll email guest@example.com")
    await waitFor(() => expect(events).toContainEqual({ event: 'back_in_stock_subscribed', variantId: VARIANT }))
    off()
  })

  it('is one click for a signed-in customer, using the account email', async () => {
    customerState.current = { status: 'ready', customer: { email: 'nando@example.com' } }
    const action = vi.fn(async (): Promise<BackInStockFormState> => ({ status: 'success', email: 'nando@example.com' }))
    render(<BackInStockForm variantId={VARIANT} handle="core-hoodie" action={action} />)
    expect(document.getElementById('back-in-stock')).toHaveAttribute('data-back-in-stock', 'account')
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    expect(screen.getByText(/We'll email nando@example.com/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /notify me/i }))
    expect(await screen.findByRole('status')).toHaveTextContent('nando@example.com')
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('shows the email error inline and other errors as an alert', async () => {
    const action = vi
      .fn<(prev: BackInStockFormState, formData: FormData) => Promise<BackInStockFormState>>()
      .mockResolvedValueOnce({ status: 'error', error: 'Enter a valid email address.', code: 'INVALID_EMAIL', values: { email: 'nope@x.y' } })
      .mockResolvedValueOnce({ status: 'error', error: 'Could not save your alert. Please try again.' })
    render(<BackInStockForm variantId={VARIANT} handle="core-hoodie" action={action} />)
    await userEvent.type(screen.getByLabelText('Email'), 'nope@x.y')
    await userEvent.click(screen.getByRole('button', { name: /notify me/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.')
    expect(screen.getByLabelText('Email')).toHaveValue('nope@x.y')
    await userEvent.click(screen.getByRole('button', { name: /notify me/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not save your alert.'))
  })
})

describe('/back-in-stock/unsubscribe', () => {
  it('is dynamic and cancels the row when id + email match', async () => {
    expect(dynamic).toBe('force-dynamic')
    lib.cancelSubscription.mockResolvedValue(true)
    const { container } = render(await UnsubscribePage({ searchParams: Promise.resolve({ id: 'bis-1', email: 'a@b.co' }) }))
    expect(lib.cancelSubscription).toHaveBeenCalledWith('bis-1', 'a@b.co')
    expect(container.querySelector('[data-back-in-stock-unsubscribe]')).toHaveAttribute('data-back-in-stock-unsubscribe', 'cancelled')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('unsubscribed')
  })

  it('says nothing to turn off for an unknown link and survives a database error', async () => {
    lib.cancelSubscription.mockResolvedValue(false)
    render(await UnsubscribePage({ searchParams: Promise.resolve({ id: 'x', email: 'a@b.co' }) }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nothing to turn off')
    cleanup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    lib.cancelSubscription.mockRejectedValue(new Error('down'))
    render(await UnsubscribePage({ searchParams: Promise.resolve({ id: 'x', email: 'a@b.co' }) }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Something went wrong')
    cleanup()
    render(await UnsubscribePage({ searchParams: Promise.resolve({}) }))
    expect(lib.cancelSubscription).toHaveBeenCalledTimes(2)
  })
})
