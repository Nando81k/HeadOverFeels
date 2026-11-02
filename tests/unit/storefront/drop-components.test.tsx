// tests/unit/storefront/drop-components.test.tsx — components/storefront/drops/* (Phase 5, Task 1)
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh }),
}))

/** The gate reads the customer context; each test sets the status it needs. */
const customerState = vi.hoisted(() => ({ status: 'unavailable' as string | null }))
vi.mock('@/components/storefront/account/useCustomer', () => ({
  useCustomerOptional: () =>
    customerState.status === null ? null : { status: customerState.status, customer: null, loyalty: null, refresh: vi.fn() },
}))
vi.mock('@/app/(storefront)/_actions/drops', () => ({
  checkEarlyAccessAction: vi.fn(async () => ({ ok: false, error: 'real action called' })),
}))

import { DropCountdown } from '@/components/storefront/drops/DropCountdown'
import { DropStatus } from '@/components/storefront/drops/DropStatus'
import { EarlyAccessGate } from '@/components/storefront/drops/EarlyAccessGate'
import { dropState } from '@/lib/storefront/drops'

const NOW = new Date('2026-09-10T12:00:00Z')
const SOON = '2026-09-13T13:00:00Z'
const EARLIER = '2026-09-06T13:00:00Z'

beforeEach(() => {
  vi.clearAllMocks()
  customerState.status = 'unavailable'
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('DropStatus', () => {
  it('shows the upcoming badge, opening time, window and a countdown', () => {
    vi.useFakeTimers({ now: NOW })
    const { container } = render(<DropStatus view={dropState({ start: SOON, end: null }, NOW)!} />)

    expect(container.querySelector('[data-drop-status="upcoming"]')).toBeInTheDocument()
    expect(screen.getByText('Drop')).toBeInTheDocument()
    expect(screen.getByText('Opens Sep 13, 9:00 AM')).toBeInTheDocument()
    expect(screen.getByText('From Sep 13')).toBeInTheDocument()
    expect(screen.getByText('Early access for members')).toBeInTheDocument()
    expect(screen.getByText('Opens in')).toBeInTheDocument()
    expect(container.querySelector('[data-drop-countdown] time')).toHaveTextContent('03d 01h 00m 00s')
  })

  it('shows live copy with a closing countdown, and none when open-ended', () => {
    vi.useFakeTimers({ now: NOW })
    const { container, rerender } = render(
      <DropStatus view={dropState({ start: EARLIER, end: SOON }, NOW)!} />
    )
    expect(screen.getByText('Live now')).toBeInTheDocument()
    expect(screen.getByText('Closes in')).toBeInTheDocument()

    rerender(<DropStatus view={dropState({ start: EARLIER, end: null }, NOW)!} />)
    expect(container.querySelector('[data-drop-countdown]')).toBeNull()
  })

  it('shows the ended state with no countdown', () => {
    const { container } = render(<DropStatus view={dropState({ start: null, end: EARLIER }, NOW)!} />)

    expect(screen.getByText('Drop ended')).toBeInTheDocument()
    expect(screen.getByText('This drop has ended')).toBeInTheDocument()
    expect(container.querySelector('[data-drop-countdown]')).toBeNull()
  })

  it('shows early access copy', () => {
    render(<DropStatus view={dropState({ start: SOON, end: null }, NOW, true)!} countdown={false} />)

    expect(screen.getByText('Early access')).toBeInTheDocument()
    expect(screen.getByText('Yours before everyone else')).toBeInTheDocument()
    expect(screen.getByText('Opens to all Sep 13, 9:00 AM')).toBeInTheDocument()
  })
})

describe('DropCountdown', () => {
  it('ticks every second and refreshes the route once at zero', () => {
    vi.useFakeTimers({ now: new Date('2026-09-13T12:59:58Z') })
    const { container } = render(<DropCountdown target={SOON} />)

    const time = container.querySelector('time') as HTMLElement
    expect(time).toHaveAttribute('dateTime', SOON)
    expect(time).toHaveTextContent('00h 00m 02s')

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(time).toHaveTextContent('00h 00m 01s')

    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(time).toHaveTextContent('00h 00m 00s')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('renders nothing for an invalid target', () => {
    const { container } = render(<DropCountdown target="nope" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('EarlyAccessGate', () => {
  const Child = ({ locked }: { locked: boolean }) => <button disabled={locked}>{locked ? 'Opens Sep 13' : 'Add to cart'}</button>

  it('stays locked without a customer context and asks nothing', async () => {
    customerState.status = null
    const check = vi.fn()
    render(
      <EarlyAccessGate handle="drop-01" check={check} locked={<Child locked />} unlocked={<Child locked={false} />} />
    )

    expect(screen.getByRole('button', { name: 'Opens Sep 13' })).toBeDisabled()
    expect(check).not.toHaveBeenCalled()
  })

  it('invites a signed-out visitor to sign in, returning to the PDP', () => {
    customerState.status = 'signed-out'
    render(
      <EarlyAccessGate handle="drop-01" check={vi.fn()} locked={<Child locked />} unlocked={<Child locked={false} />} />
    )

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/account/login?return_to=%2Fproducts%2Fdrop-01'
    )
  })

  it('unlocks when the server grants access to the signed-in customer', async () => {
    customerState.status = 'ready'
    const check = vi.fn(async () => ({ ok: true as const, data: { hasEarlyAccess: true } }))
    const { container } = render(
      <EarlyAccessGate handle="drop-01" check={check} locked={<Child locked />} unlocked={<Child locked={false} />} />
    )

    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled())
    expect(check).toHaveBeenCalledWith('drop-01')
    expect(container.querySelector('[data-early-access="granted"]')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/early access unlocked/i)
    expect((window as unknown as { dataLayer: unknown[] }).dataLayer).toContainEqual({
      event: 'early_access_unlocked',
      handle: 'drop-01',
    })
  })

  it('stays locked and explains when access is denied', async () => {
    customerState.status = 'ready'
    const check = vi.fn(async () => ({ ok: true as const, data: { hasEarlyAccess: false } }))
    const { container } = render(
      <EarlyAccessGate handle="drop-01" check={check} locked={<Child locked />} unlocked={<Child locked={false} />} />
    )

    await waitFor(() => expect(container.querySelector('[data-early-access="denied"]')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Opens Sep 13' })).toBeDisabled()
    expect(screen.getByText(/opens for gold members/i)).toBeInTheDocument()
  })
})
