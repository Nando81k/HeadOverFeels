// tests/unit/storefront/wishlist-provider.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'

/*
 * `WishlistProvider` (Phase 4, Task 7): guest list in localStorage, server list
 * after sign-in, a one-time merge in between, optimistic toggles with rollback.
 * The Server Actions and the customer context are mocked with their documented
 * contracts; the storage helpers are real (jsdom localStorage).
 */

const { actions, customerState } = vi.hoisted(() => ({
  actions: {
    getWishlistAction: vi.fn(),
    toggleWishlistAction: vi.fn(),
    mergeGuestWishlistAction: vi.fn(),
    wishlistCardsAction: vi.fn(),
  },
  customerState: { current: null as null | { status: string } },
}))

vi.mock('server-only', () => ({}))
vi.mock('@/app/(storefront)/_actions/wishlist', () => actions)
vi.mock('@/components/storefront/account/useCustomer', () => ({
  useCustomerOptional: () => customerState.current,
}))

import { WishlistProvider } from '@/components/storefront/wishlist/WishlistProvider'
import {
  useWishlist,
  useWishlistOptional,
  type WishlistContextValue,
} from '@/components/storefront/wishlist/useWishlist'
import {
  WISHLIST_STORAGE_KEY,
  readGuestWishlist,
  type WishlistActionResult,
  type WishlistEntry,
} from '@/lib/storefront/wishlist'

const HOODIE = 'gid://shopify/ProductVariant/45123456789005'
const CREW = 'gid://shopify/ProductVariant/45123456789205'
const TEE = 'gid://shopify/ProductVariant/45123456789301'

const entry = (variantId: string, productHandle: string, addedAt: string): WishlistEntry => ({
  variantId,
  productHandle,
  addedAt,
})

const GUEST: WishlistEntry[] = [
  entry(HOODIE, 'core-hoodie', '2026-10-01T10:00:00.000Z'),
  entry(CREW, 'core-crew', '2026-10-02T10:00:00.000Z'),
]
const SERVER: WishlistEntry[] = [entry(TEE, 'box-tee', '2026-09-20T10:00:00.000Z')]

const ok = (entries: WishlistEntry[]): WishlistActionResult => ({ ok: true, entries })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** The live context, captured after each commit so tests can drive it outside React. */
let ctx: WishlistContextValue
const capture = (value: WishlistContextValue) => {
  ctx = value
}

function Probe() {
  const value = useWishlist()
  React.useEffect(() => capture(value))
  return (
    <div>
      <output data-testid="status">{value.status}</output>
      <output data-testid="count">{value.count}</output>
      <output data-testid="merged">{value.merged}</output>
      <output data-testid="error">{value.error ?? ''}</output>
      <ul>
        {value.entries.map((item) => (
          <li key={item.variantId} data-testid="entry">
            {item.productHandle}
          </li>
        ))}
      </ul>
    </div>
  )
}

const status = () => screen.getByTestId('status').textContent
const count = () => Number(screen.getByTestId('count').textContent)
const handles = () => screen.getAllByTestId('entry').map((node) => node.textContent)

function seedGuest(entries: WishlistEntry[]) {
  window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(entries))
}

function renderProvider(ui: React.ReactNode = <Probe />) {
  return render(<WishlistProvider>{ui}</WishlistProvider>)
}

beforeEach(() => {
  window.localStorage.clear()
  customerState.current = null
  actions.getWishlistAction.mockResolvedValue(ok([]))
  actions.mergeGuestWishlistAction.mockResolvedValue(ok([]))
  actions.toggleWishlistAction.mockResolvedValue(ok([]))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ------------------------------------------------------------------ hooks

describe('useWishlist / useWishlistOptional', () => {
  it('useWishlistOptional is null outside a provider', () => {
    function Optional() {
      const value = useWishlistOptional()
      return <output data-testid="optional">{value === null ? 'null' : 'value'}</output>
    }
    render(<Optional />)
    expect(screen.getByTestId('optional').textContent).toBe('null')
  })

  it('useWishlist throws outside a provider', () => {
    expect(() => render(<Probe />)).toThrow(/WishlistProvider/)
  })
})

// ------------------------------------------------------------------ guest

describe('WishlistProvider (guest)', () => {
  it('starts empty on the first render and reads localStorage in an effect', async () => {
    seedGuest(GUEST)
    renderProvider()

    await waitFor(() => expect(count()).toBe(2))
    expect(status()).toBe('guest')
    expect(handles()).toEqual(['core-hoodie', 'core-crew'])
    expect(ctx.has(HOODIE)).toBe(true)
    expect(ctx.has(TEE)).toBe(false)
    expect(actions.getWishlistAction).not.toHaveBeenCalled()
  })

  it('treats corrupt storage as an empty list', async () => {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, '{nope')
    renderProvider()

    await waitFor(() => expect(status()).toBe('guest'))
    expect(count()).toBe(0)
  })

  it('toggle adds then removes locally and writes localStorage without calling the server', async () => {
    renderProvider()
    await waitFor(() => expect(status()).toBe('guest'))

    let result: WishlistActionResult | undefined
    await act(async () => {
      result = await ctx.toggle(HOODIE, 'core-hoodie')
    })
    expect(result).toMatchObject({ ok: true })
    expect(count()).toBe(1)
    expect(ctx.has(HOODIE)).toBe(true)
    expect(readGuestWishlist().map((item) => item.variantId)).toEqual([HOODIE])

    await act(async () => {
      await ctx.toggle(CREW, 'core-crew')
    })
    // Newest first.
    expect(readGuestWishlist().map((item) => item.variantId)).toEqual([CREW, HOODIE])

    await act(async () => {
      await ctx.toggle(HOODIE, 'core-hoodie')
    })
    expect(count()).toBe(1)
    expect(readGuestWishlist().map((item) => item.variantId)).toEqual([CREW])
    expect(actions.toggleWishlistAction).not.toHaveBeenCalled()
  })
})

// ------------------------------------------------------------------ sign-in

describe('WishlistProvider (signed in)', () => {
  it('loads the server list once the customer is ready', async () => {
    customerState.current = { status: 'loading' }
    actions.getWishlistAction.mockResolvedValue(ok(SERVER))
    const { rerender } = renderProvider()
    await waitFor(() => expect(status()).toBe('guest'))
    expect(actions.getWishlistAction).not.toHaveBeenCalled()

    customerState.current = { status: 'ready' }
    rerender(
      <WishlistProvider>
        <Probe />
      </WishlistProvider>
    )

    await waitFor(() => expect(status()).toBe('ready'))
    expect(actions.getWishlistAction).toHaveBeenCalledTimes(1)
    expect(actions.mergeGuestWishlistAction).not.toHaveBeenCalled()
    expect(handles()).toEqual(['box-tee'])
    expect(screen.getByTestId('merged').textContent).toBe('0')
  })

  it('merges guest entries once after sign-in, clears storage and reports the count', async () => {
    seedGuest(GUEST)
    customerState.current = { status: 'ready' }
    actions.getWishlistAction.mockResolvedValue(ok(SERVER))
    const merged = [...GUEST].reverse().concat(SERVER)
    actions.mergeGuestWishlistAction.mockResolvedValue(ok(merged))

    const { rerender } = renderProvider()

    await waitFor(() => expect(status()).toBe('ready'))
    expect(actions.mergeGuestWishlistAction).toHaveBeenCalledTimes(1)
    expect(actions.mergeGuestWishlistAction).toHaveBeenCalledWith(GUEST)
    expect(handles()).toEqual(['core-crew', 'core-hoodie', 'box-tee'])
    expect(screen.getByTestId('merged').textContent).toBe('2')
    expect(window.localStorage.getItem(WISHLIST_STORAGE_KEY)).toBeNull()

    // A re-render with the same customer never merges again.
    rerender(
      <WishlistProvider>
        <Probe />
      </WishlistProvider>
    )
    await act(async () => {})
    expect(actions.mergeGuestWishlistAction).toHaveBeenCalledTimes(1)
    expect(actions.getWishlistAction).toHaveBeenCalledTimes(1)

    act(() => ctx.dismissMerged())
    expect(screen.getByTestId('merged').textContent).toBe('0')
  })

  it('keeps the guest list locally when the merge fails, so it can be retried', async () => {
    seedGuest(GUEST)
    customerState.current = { status: 'ready' }
    actions.getWishlistAction.mockResolvedValue(ok(SERVER))
    actions.mergeGuestWishlistAction.mockResolvedValue({ ok: false, error: 'Merge failed' })

    renderProvider()

    await waitFor(() => expect(status()).toBe('ready'))
    expect(handles()).toEqual(['core-crew', 'core-hoodie', 'box-tee'])
    expect(screen.getByTestId('merged').textContent).toBe('0')
    expect(screen.getByTestId('error').textContent).toBe('Merge failed')
    expect(readGuestWishlist()).toEqual(GUEST)
  })

  it('stays a guest when the server has no list for this session (SIGNED_OUT)', async () => {
    seedGuest(GUEST)
    customerState.current = { status: 'ready' }
    actions.mergeGuestWishlistAction.mockResolvedValue({ ok: false, error: 'SIGNED_OUT' })

    renderProvider()

    await waitFor(() => expect(actions.mergeGuestWishlistAction).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(status()).toBe('guest'))
    expect(handles()).toEqual(['core-hoodie', 'core-crew'])
    expect(readGuestWishlist()).toEqual(GUEST)
    expect(screen.getByTestId('error').textContent).toBe('')
  })

  it('falls back to the guest list with the load error when the server read fails', async () => {
    customerState.current = { status: 'ready' }
    actions.getWishlistAction.mockResolvedValue({ ok: false, error: 'Load failed' })

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('Load failed'))
    expect(status()).toBe('guest')
    expect(actions.mergeGuestWishlistAction).not.toHaveBeenCalled()
  })

  it('returns to the guest list after sign-out', async () => {
    customerState.current = { status: 'ready' }
    actions.getWishlistAction.mockResolvedValue(ok(SERVER))
    const { rerender } = renderProvider()
    await waitFor(() => expect(status()).toBe('ready'))

    customerState.current = { status: 'signed-out' }
    rerender(
      <WishlistProvider>
        <Probe />
      </WishlistProvider>
    )

    await waitFor(() => expect(status()).toBe('guest'))
    expect(count()).toBe(0)
  })
})

// ------------------------------------------------------------------ toggle

describe('WishlistProvider toggle (signed in)', () => {
  async function signedIn(server: WishlistEntry[] = SERVER) {
    customerState.current = { status: 'ready' }
    actions.getWishlistAction.mockResolvedValue(ok(server))
    renderProvider()
    await waitFor(() => expect(status()).toBe('ready'))
  }

  it('is optimistic and then takes the server list', async () => {
    await signedIn()
    const pending = deferred<WishlistActionResult>()
    actions.toggleWishlistAction.mockReturnValue(pending.promise)

    let promise!: Promise<WishlistActionResult>
    act(() => {
      promise = ctx.toggle(HOODIE, 'core-hoodie')
    })

    expect(ctx.has(HOODIE)).toBe(true)
    expect(handles()).toEqual(['core-hoodie', 'box-tee'])
    expect(actions.toggleWishlistAction).toHaveBeenCalledWith({
      variantId: HOODIE,
      productHandle: 'core-hoodie',
    })

    const fromServer = [entry(HOODIE, 'core-hoodie', '2026-10-11T00:00:00.000Z'), ...SERVER]
    await act(async () => {
      pending.resolve(ok(fromServer))
      await promise
    })
    expect(ctx.entries).toEqual(fromServer)
    expect(window.localStorage.getItem(WISHLIST_STORAGE_KEY)).toBeNull()
  })

  it('rolls back an add and surfaces the error on { ok: false }', async () => {
    await signedIn()
    actions.toggleWishlistAction.mockResolvedValue({ ok: false, error: 'Update failed' })

    await act(async () => {
      await ctx.toggle(HOODIE, 'core-hoodie')
    })

    expect(ctx.has(HOODIE)).toBe(false)
    expect(handles()).toEqual(['box-tee'])
    expect(screen.getByTestId('error').textContent).toBe('Update failed')
    expect(status()).toBe('ready')

    act(() => ctx.clearError())
    expect(screen.getByTestId('error').textContent).toBe('')
  })

  it('rolls back a removal to its original position when the action rejects', async () => {
    const server = [
      entry(CREW, 'core-crew', '2026-10-03T00:00:00.000Z'),
      entry(HOODIE, 'core-hoodie', '2026-10-02T00:00:00.000Z'),
      ...SERVER,
    ]
    await signedIn(server)
    actions.toggleWishlistAction.mockRejectedValue(new Error('network'))

    let result: WishlistActionResult | undefined
    await act(async () => {
      result = await ctx.toggle(HOODIE, 'core-hoodie')
    })

    expect(result).toMatchObject({ ok: false })
    expect(ctx.entries).toEqual(server)
    expect(screen.getByTestId('error').textContent).not.toBe('')
  })

  it('keeps the optimistic list and drops to guest mode on SIGNED_OUT', async () => {
    await signedIn([])
    actions.toggleWishlistAction.mockResolvedValue({ ok: false, error: 'SIGNED_OUT' })

    await act(async () => {
      await ctx.toggle(HOODIE, 'core-hoodie')
    })

    expect(status()).toBe('guest')
    expect(ctx.has(HOODIE)).toBe(true)
    expect(readGuestWishlist().map((item) => item.variantId)).toEqual([HOODIE])
    expect(screen.getByTestId('error').textContent).toBe('')
  })
})
