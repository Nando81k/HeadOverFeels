// tests/unit/storefront/account-provider.test.tsx
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'

vi.mock('server-only', () => ({}))
// The provider's default action is the real Server Action; every test injects
// a fake through `actions`, and this stub proves the default is never reached.
vi.mock('@/app/(storefront)/_actions/account', () => ({
  getCustomerSummaryAction: vi.fn(async () => ({
    status: 'ready',
    customer: { displayName: 'real action called' },
    loyalty: null,
  })),
}))

import { getCustomerSummaryAction, type CustomerSummaryState } from '@/app/(storefront)/_actions/account'
import {
  CustomerProvider,
  type CustomerActions,
  type CustomerContextValue,
} from '@/components/storefront/account/CustomerProvider'
import { useCustomer, useCustomerOptional } from '@/components/storefront/account/useCustomer'
import { normalizeCustomerSummary, type RawCustomerSummary } from '@/lib/shopify/customer/queries'
import customerFixture from '@/tests/fixtures/shopify/customer/customer.json'

const CUSTOMER = normalizeCustomerSummary(customerFixture as unknown as RawCustomerSummary)
const LOYALTY = { points: 1240, tierName: 'Gold', nextTierName: 'Platinum', pointsToNext: 760, multiplier: 1 }
const READY: CustomerSummaryState = { status: 'ready', customer: CUSTOMER, loyalty: LOYALTY }

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let ctx: CustomerContextValue
function Probe() {
  const value = useCustomer()
  React.useEffect(() => {
    ctx = value
  })
  return (
    <div>
      <output data-testid="status">{value.status}</output>
      <output data-testid="name">{value.customer?.displayName ?? ''}</output>
      <output data-testid="points">{value.loyalty?.points ?? ''}</output>
    </div>
  )
}

describe('CustomerProvider', () => {
  it('starts loading, calls the summary action once and becomes ready', async () => {
    const getSummary = vi.fn<CustomerActions['getSummary']>(async () => READY)
    render(
      <CustomerProvider actions={{ getSummary }}>
        <Probe />
      </CustomerProvider>
    )
    expect(screen.getByTestId('status')).toHaveTextContent('loading')

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
    expect(screen.getByTestId('name')).toHaveTextContent('Nando Alvarez')
    expect(screen.getByTestId('points')).toHaveTextContent('1240')
    expect(getSummary).toHaveBeenCalledTimes(1)
    expect(getCustomerSummaryAction).not.toHaveBeenCalled()
  })

  it('fetches once even when StrictMode replays the mount effect', async () => {
    const getSummary = vi.fn<CustomerActions['getSummary']>(async () => READY)
    render(
      <React.StrictMode>
        <CustomerProvider actions={{ getSummary }}>
          <Probe />
        </CustomerProvider>
      </React.StrictMode>
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
    expect(getSummary).toHaveBeenCalledTimes(1)
  })

  it.each(['signed-out', 'expired', 'unavailable'] as const)('mirrors the %s status', async (status) => {
    const getSummary = vi.fn<CustomerActions['getSummary']>(async () => ({
      status,
      customer: null,
      loyalty: null,
    }))
    render(
      <CustomerProvider actions={{ getSummary }}>
        <Probe />
      </CustomerProvider>
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent(status))
    expect(screen.getByTestId('name')).toHaveTextContent('')
  })

  it('is unavailable without a fetch when the server says accounts are off', () => {
    const getSummary = vi.fn<CustomerActions['getSummary']>(async () => READY)
    render(
      <CustomerProvider available={false} actions={{ getSummary }}>
        <Probe />
      </CustomerProvider>
    )
    expect(screen.getByTestId('status')).toHaveTextContent('unavailable')
    expect(getSummary).not.toHaveBeenCalled()
  })

  it('treats a rejected action as signed out', async () => {
    const getSummary = vi.fn<CustomerActions['getSummary']>(async () => {
      throw new Error('network')
    })
    render(
      <CustomerProvider actions={{ getSummary }}>
        <Probe />
      </CustomerProvider>
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed-out'))
  })

  it('refresh() re-reads the summary and keeps the last customer while loading', async () => {
    const first = deferred<CustomerSummaryState>()
    const second = deferred<CustomerSummaryState>()
    const getSummary = vi
      .fn<CustomerActions['getSummary']>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    render(
      <CustomerProvider actions={{ getSummary }}>
        <Probe />
      </CustomerProvider>
    )
    await act(async () => first.resolve(READY))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))

    let done: Promise<void> | undefined
    act(() => {
      done = ctx.refresh()
    })
    expect(getSummary).toHaveBeenCalledTimes(2)
    // The old customer stays on screen while the refresh is in flight.
    expect(screen.getByTestId('name')).toHaveTextContent('Nando Alvarez')

    await act(async () => {
      second.resolve({ status: 'signed-out', customer: null, loyalty: null })
      await done
    })
    expect(screen.getByTestId('status')).toHaveTextContent('signed-out')
    expect(screen.getByTestId('name')).toHaveTextContent('')
  })
})

describe('useCustomer / useCustomerOptional', () => {
  it('useCustomer throws outside a provider', () => {
    const Bare = () => {
      useCustomer()
      return null
    }
    expect(() => render(<Bare />)).toThrow(/CustomerProvider/)
  })

  it('useCustomerOptional returns null outside a provider', () => {
    const Bare = () => <output data-testid="ctx">{String(useCustomerOptional())}</output>
    render(<Bare />)
    expect(screen.getByTestId('ctx')).toHaveTextContent('null')
  })
})
