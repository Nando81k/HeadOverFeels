// tests/unit/storefront/cart-provider.test.tsx
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))
// The provider's default actions are the real Server Actions; every test here
// injects fakes through the `actions` prop, and this stub proves the defaults
// are never reached when a fake is given.
vi.mock('@/app/(storefront)/_actions/cart', () => ({
  getCartAction: vi.fn(async () => null),
  addCartLine: vi.fn(async () => ({ ok: false, error: 'real action called' })),
  updateCartLine: vi.fn(async () => ({ ok: false, error: 'real action called' })),
  removeCartLine: vi.fn(async () => ({ ok: false, error: 'real action called' })),
  applyDiscountCode: vi.fn(async () => ({ ok: false, error: 'real action called' })),
  removeDiscountCode: vi.fn(async () => ({ ok: false, error: 'real action called' })),
  updateCartNoteAction: vi.fn(async () => ({ ok: false, error: 'real action called' })),
}))

import { CartBadge } from '@/components/storefront/cart/CartBadge'
import {
  CartProvider,
  useCart as useCartFromProvider,
  type CartActions,
  type CartContextValue,
} from '@/components/storefront/cart/CartProvider'
import { useCart, useCartOptional } from '@/components/storefront/cart/useCart'
import { getCartAction } from '@/app/(storefront)/_actions/cart'
import { normalizeCart, type RawCart } from '@/lib/shopify/queries/cart'
import type { Cart, CartActionResult } from '@/lib/shopify/types'
import cartFixture from '@/tests/fixtures/shopify/cart.json'

const CART: Cart = normalizeCart(cartFixture.cart as unknown as RawCart)
const [HOODIE, TEE] = CART.lines

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

/** The live context, captured after each commit so tests can drive it outside React. */
let ctx: CartContextValue
const capture = (value: CartContextValue) => {
  ctx = value
}

function Probe() {
  const value = useCart()
  React.useEffect(() => capture(value))
  return (
    <div>
      <output data-testid="status">{value.status}</output>
      <output data-testid="count">{value.count}</output>
      <output data-testid="open">{String(value.open)}</output>
      <output data-testid="pending">{String(value.pending)}</output>
      <output data-testid="pending-line">{value.pendingLineId ?? ''}</output>
      <output data-testid="error">{value.error ?? ''}</output>
      <output data-testid="warning">{value.warning ?? ''}</output>
      <ul>
        {(value.cart?.lines ?? []).map((line) => (
          <li key={line.id} data-testid="line">
            {line.merchandise.product.title}:{line.quantity}
          </li>
        ))}
      </ul>
    </div>
  )
}

const text = (id: string) => screen.getByTestId(id).textContent
const lines = () => screen.queryAllByTestId('line').map((li) => li.textContent)

function fakeActions(overrides: Partial<CartActions> = {}): CartActions {
  const fail = async (): Promise<CartActionResult> => ({ ok: false, error: 'not stubbed' })
  return {
    getCart: vi.fn(async () => CART),
    addLine: vi.fn(fail),
    updateLine: vi.fn(fail),
    removeLine: vi.fn(fail),
    applyCode: vi.fn(fail),
    removeCode: vi.fn(fail),
    setNote: vi.fn(fail),
    ...overrides,
  }
}

function withQuantity(cart: Cart, lineId: string, quantity: number): Cart {
  const next = cart.lines.map((line) => (line.id === lineId ? { ...line, quantity } : line))
  return { ...cart, lines: next, totalQuantity: next.reduce((sum, l) => sum + l.quantity, 0) }
}

describe('CartProvider: loading', () => {
  it('calls getCart once on mount and becomes ready with the cart count', async () => {
    const actions = fakeActions()
    render(
      <React.StrictMode>
        <CartProvider actions={actions}>
          <Probe />
        </CartProvider>
      </React.StrictMode>
    )

    expect(text('status')).toBe('loading')
    await waitFor(() => expect(text('status')).toBe('ready'))
    expect(actions.getCart).toHaveBeenCalledTimes(1)
    expect(text('count')).toBe(String(CART.totalQuantity))
    expect(lines()).toHaveLength(2)
  })

  it('treats a null cart as an empty, ready cart', async () => {
    const actions = fakeActions({ getCart: vi.fn(async () => null) })
    render(
      <CartProvider actions={actions}>
        <Probe />
      </CartProvider>
    )
    await waitFor(() => expect(text('status')).toBe('ready'))
    expect(text('count')).toBe('0')
    expect(ctx.cart).toBeNull()
  })

  it('stays unavailable and never fetches when the store is not configured', async () => {
    const actions = fakeActions()
    render(
      <CartProvider available={false} actions={actions}>
        <Probe />
      </CartProvider>
    )
    expect(text('status')).toBe('unavailable')
    await act(async () => {})
    expect(actions.getCart).not.toHaveBeenCalled()
    expect(text('status')).toBe('unavailable')
    expect(text('count')).toBe('0')
  })

  it('uses initialCart without fetching', async () => {
    const actions = fakeActions()
    render(
      <CartProvider initialCart={CART} actions={actions}>
        <Probe />
      </CartProvider>
    )
    expect(text('status')).toBe('ready')
    expect(text('count')).toBe('2')
    await act(async () => {})
    expect(actions.getCart).not.toHaveBeenCalled()
  })

  it('treats initialCart={null} as a known empty cart', async () => {
    const actions = fakeActions()
    render(
      <CartProvider initialCart={null} actions={actions}>
        <Probe />
      </CartProvider>
    )
    expect(text('status')).toBe('ready')
    await act(async () => {})
    expect(actions.getCart).not.toHaveBeenCalled()
  })

  it('defaults to the real Server Actions when no fakes are injected', async () => {
    render(
      <CartProvider>
        <Probe />
      </CartProvider>
    )
    await waitFor(() => expect(text('status')).toBe('ready'))
    expect(getCartAction).toHaveBeenCalledTimes(1)
  })

  it('lets a nested provider seed its own state', async () => {
    const outer = fakeActions({ getCart: vi.fn(async () => null) })
    const inner = fakeActions()
    const seen: (CartContextValue | null)[] = []
    function OuterProbe() {
      const value = useCartOptional()
      React.useEffect(() => {
        seen.push(value)
      })
      return null
    }
    const outerCtx = () => seen[seen.length - 1]
    render(
      <CartProvider actions={outer}>
        <OuterProbe />
        <CartProvider initialCart={CART} actions={inner}>
          <Probe />
        </CartProvider>
      </CartProvider>
    )
    expect(text('count')).toBe('2')
    await waitFor(() => expect(outerCtx()?.status).toBe('ready'))
    expect(outerCtx()?.count).toBe(0)
    expect(inner.getCart).not.toHaveBeenCalled()
  })
})

describe('CartProvider: addLine', () => {
  it('calls the add action, replaces the cart, opens the drawer and surfaces a warning', async () => {
    const after = withQuantity(CART, TEE.id, 2)
    const addLine = vi.fn(
      async (): Promise<CartActionResult> => ({ ok: true, cart: after, warning: 'Only 1 left' })
    )
    render(
      <CartProvider initialCart={null} actions={fakeActions({ addLine })}>
        <Probe />
      </CartProvider>
    )
    expect(text('open')).toBe('false')

    let result: CartActionResult | undefined
    await act(async () => {
      result = await ctx.addLine({ variantId: TEE.merchandise.id, quantity: 2 })
    })

    expect(addLine).toHaveBeenCalledWith({ variantId: TEE.merchandise.id, quantity: 2 })
    expect(result).toEqual({ ok: true, cart: after, warning: 'Only 1 left' })
    expect(text('count')).toBe('3')
    expect(text('open')).toBe('true')
    expect(text('warning')).toBe('Only 1 left')
    expect(text('error')).toBe('')
    expect(text('pending')).toBe('false')
  })

  it('reports pending while the add is in flight', async () => {
    const gate = deferred<CartActionResult>()
    render(
      <CartProvider initialCart={null} actions={fakeActions({ addLine: () => gate.promise })}>
        <Probe />
      </CartProvider>
    )

    let promise!: Promise<CartActionResult>
    act(() => {
      promise = ctx.addLine({ variantId: TEE.merchandise.id })
    })
    expect(text('pending')).toBe('true')

    await act(async () => {
      gate.resolve({ ok: true, cart: CART })
      await promise
    })
    expect(text('pending')).toBe('false')
  })

  it('keeps the drawer closed when asked', async () => {
    const addLine = vi.fn(async (): Promise<CartActionResult> => ({ ok: true, cart: CART }))
    render(
      <CartProvider initialCart={null} actions={fakeActions({ addLine })}>
        <Probe />
      </CartProvider>
    )
    await act(async () => {
      await ctx.addLine({ variantId: TEE.merchandise.id }, { open: false })
    })
    expect(text('count')).toBe('2')
    expect(text('open')).toBe('false')
  })

  it('sets error (and adopts a returned cart) when the add fails', async () => {
    const addLine = vi.fn(
      async (): Promise<CartActionResult> => ({ ok: false, error: 'Sold out', cart: CART })
    )
    render(
      <CartProvider initialCart={null} actions={fakeActions({ addLine })}>
        <Probe />
      </CartProvider>
    )
    await act(async () => {
      await ctx.addLine({ variantId: TEE.merchandise.id })
    })
    expect(text('error')).toBe('Sold out')
    expect(text('count')).toBe('2')
    expect(text('open')).toBe('false')
  })
})

describe('CartProvider: optimistic line edits', () => {
  it('updateLine changes quantity and count before the action resolves', async () => {
    const gate = deferred<CartActionResult>()
    const updateLine = vi.fn(() => gate.promise)
    render(
      <CartProvider initialCart={CART} actions={fakeActions({ updateLine })}>
        <Probe />
      </CartProvider>
    )

    let promise!: Promise<CartActionResult>
    act(() => {
      promise = ctx.updateLine(HOODIE.id, 3)
    })

    expect(updateLine).toHaveBeenCalledWith({ lineId: HOODIE.id, quantity: 3 })
    expect(text('count')).toBe('4')
    expect(lines()).toContain(`${HOODIE.merchandise.product.title}:3`)
    expect(text('pending-line')).toBe(HOODIE.id)
    expect(text('pending')).toBe('true')

    const server = withQuantity(CART, HOODIE.id, 3)
    await act(async () => {
      gate.resolve({ ok: true, cart: server })
      await promise
    })
    expect(text('count')).toBe('4')
    expect(ctx.cart).toBe(server)
    expect(text('pending-line')).toBe('')
    expect(text('pending')).toBe('false')
  })

  it('updateLine rolls back and sets error when the action fails', async () => {
    const gate = deferred<CartActionResult>()
    render(
      <CartProvider initialCart={CART} actions={fakeActions({ updateLine: () => gate.promise })}>
        <Probe />
      </CartProvider>
    )

    let promise!: Promise<CartActionResult>
    act(() => {
      promise = ctx.updateLine(TEE.id, 5)
    })
    expect(text('count')).toBe('6')

    await act(async () => {
      gate.resolve({ ok: false, error: 'Only 1 left' })
      await promise
    })
    expect(text('count')).toBe('2')
    expect(lines()).toContain(`${TEE.merchandise.product.title}:1`)
    expect(ctx.cart).toBe(CART)
    expect(text('error')).toBe('Only 1 left')
    expect(text('pending-line')).toBe('')
  })

  it('updateLine to 0 drops the line optimistically', () => {
    render(
      <CartProvider
        initialCart={CART}
        actions={fakeActions({ updateLine: () => new Promise<CartActionResult>(() => {}) })}
      >
        <Probe />
      </CartProvider>
    )
    act(() => {
      void ctx.updateLine(TEE.id, 0)
    })
    expect(lines()).toEqual([`${HOODIE.merchandise.product.title}:1`])
    expect(text('count')).toBe('1')
  })

  it('removeLine drops the line before the action resolves and keeps the server cart after', async () => {
    const gate = deferred<CartActionResult>()
    const removeLine = vi.fn(() => gate.promise)
    render(
      <CartProvider initialCart={CART} actions={fakeActions({ removeLine })}>
        <Probe />
      </CartProvider>
    )

    let promise!: Promise<CartActionResult>
    act(() => {
      promise = ctx.removeLine(HOODIE.id)
    })
    expect(removeLine).toHaveBeenCalledWith({ lineId: HOODIE.id })
    expect(lines()).toEqual([`${TEE.merchandise.product.title}:1`])
    expect(text('count')).toBe('1')
    expect(text('pending-line')).toBe(HOODIE.id)

    const server: Cart = { ...CART, lines: [TEE], totalQuantity: 1 }
    await act(async () => {
      gate.resolve({ ok: true, cart: server })
      await promise
    })
    expect(ctx.cart).toBe(server)
    expect(text('pending-line')).toBe('')
  })

  it('removeLine rolls back on failure', async () => {
    const removeLine = vi.fn(
      async (): Promise<CartActionResult> => ({ ok: false, error: 'Something went wrong' })
    )
    render(
      <CartProvider initialCart={CART} actions={fakeActions({ removeLine })}>
        <Probe />
      </CartProvider>
    )
    await act(async () => {
      await ctx.removeLine(HOODIE.id)
    })
    expect(lines()).toHaveLength(2)
    expect(text('count')).toBe('2')
    expect(text('error')).toBe('Something went wrong')
  })

  it('rolls back only the failed edit when two edits overlap', async () => {
    const first = deferred<CartActionResult>()
    const second = deferred<CartActionResult>()
    const updateLine = vi
      .fn<CartActions['updateLine']>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    render(
      <CartProvider initialCart={CART} actions={fakeActions({ updateLine })}>
        <Probe />
      </CartProvider>
    )

    let p1!: Promise<CartActionResult>
    let p2!: Promise<CartActionResult>
    act(() => {
      p1 = ctx.updateLine(HOODIE.id, 2)
    })
    act(() => {
      p2 = ctx.updateLine(TEE.id, 3)
    })
    expect(text('count')).toBe('5')

    // First edit fails: only its change disappears; the second stays applied.
    await act(async () => {
      first.resolve({ ok: false, error: 'nope' })
      await p1
    })
    expect(lines()).toEqual([
      `${HOODIE.merchandise.product.title}:1`,
      `${TEE.merchandise.product.title}:3`,
    ])

    const server = withQuantity(CART, TEE.id, 3)
    await act(async () => {
      second.resolve({ ok: true, cart: server })
      await p2
    })
    expect(ctx.cart).toBe(server)
    expect(text('count')).toBe('4')
  })
})

describe('CartProvider: codes, note, messages', () => {
  it('applyCode replaces the cart on success', async () => {
    const after: Cart = { ...CART, discountCodes: [{ code: 'WELCOME', applicable: true }] }
    const applyCode = vi.fn(async (): Promise<CartActionResult> => ({ ok: true, cart: after }))
    render(
      <CartProvider initialCart={CART} actions={fakeActions({ applyCode })}>
        <Probe />
      </CartProvider>
    )
    await act(async () => {
      await ctx.applyCode('WELCOME')
    })
    expect(applyCode).toHaveBeenCalledWith({ code: 'WELCOME' })
    expect(ctx.cart).toBe(after)
  })

  it('applyCode failure surfaces error and keeps the returned cart', async () => {
    const reverted: Cart = { ...CART, discountCodes: [] }
    const applyCode = vi.fn(
      async (): Promise<CartActionResult> => ({
        ok: false,
        error: "NOPE isn't valid for this cart.",
        code: 'DISCOUNT_NOT_APPLICABLE',
        cart: reverted,
      })
    )
    render(
      <CartProvider initialCart={CART} actions={fakeActions({ applyCode })}>
        <Probe />
      </CartProvider>
    )
    let result: CartActionResult | undefined
    await act(async () => {
      result = await ctx.applyCode('NOPE')
    })
    expect(result?.ok).toBe(false)
    expect(text('error')).toBe("NOPE isn't valid for this cart.")
    expect(ctx.cart).toBe(reverted)
  })

  it('applyCode failure without a cart keeps the current cart', async () => {
    render(
      <CartProvider
        initialCart={CART}
        actions={fakeActions({
          applyCode: async () => ({ ok: false, error: 'Something went wrong' }),
        })}
      >
        <Probe />
      </CartProvider>
    )
    await act(async () => {
      await ctx.applyCode('X')
    })
    expect(ctx.cart).toBe(CART)
    expect(text('error')).toBe('Something went wrong')
  })

  it('removeCode and setNote call their actions and replace the cart', async () => {
    const noCodes: Cart = { ...CART, discountCodes: [] }
    const noted: Cart = { ...noCodes, note: 'Gift wrap please' }
    const removeCode = vi.fn(async (): Promise<CartActionResult> => ({ ok: true, cart: noCodes }))
    const setNote = vi.fn(async (): Promise<CartActionResult> => ({ ok: true, cart: noted }))
    render(
      <CartProvider initialCart={CART} actions={fakeActions({ removeCode, setNote })}>
        <Probe />
      </CartProvider>
    )
    await act(async () => {
      await ctx.removeCode('GOLD15')
    })
    expect(removeCode).toHaveBeenCalledWith({ code: 'GOLD15' })
    expect(ctx.cart).toBe(noCodes)

    await act(async () => {
      await ctx.setNote('Gift wrap please')
    })
    expect(setNote).toHaveBeenCalledWith({ note: 'Gift wrap please' })
    expect(ctx.cart).toBe(noted)
  })

  it('clearMessages clears error and warning', async () => {
    const addLine = vi.fn(
      async (): Promise<CartActionResult> => ({ ok: true, cart: CART, warning: 'Only 1 left' })
    )
    const applyCode = vi.fn(async (): Promise<CartActionResult> => ({ ok: false, error: 'Bad' }))
    render(
      <CartProvider initialCart={null} actions={fakeActions({ addLine, applyCode })}>
        <Probe />
      </CartProvider>
    )
    await act(async () => {
      await ctx.addLine({ variantId: TEE.merchandise.id })
    })
    expect(text('warning')).toBe('Only 1 left')
    await act(async () => {
      await ctx.applyCode('X')
    })
    expect(text('error')).toBe('Bad')

    act(() => ctx.clearMessages())
    expect(text('error')).toBe('')
    expect(text('warning')).toBe('')
  })

  it('opens and closes the drawer', () => {
    render(
      <CartProvider initialCart={null} actions={fakeActions()}>
        <Probe />
      </CartProvider>
    )
    act(() => ctx.openDrawer())
    expect(text('open')).toBe('true')
    act(() => ctx.closeDrawer())
    expect(text('open')).toBe('false')
  })

  it('short-circuits mutations while unavailable', async () => {
    const actions = fakeActions()
    render(
      <CartProvider available={false} actions={actions}>
        <Probe />
      </CartProvider>
    )
    let result: CartActionResult | undefined
    await act(async () => {
      result = await ctx.addLine({ variantId: TEE.merchandise.id })
    })
    expect(result).toEqual({ ok: false, error: 'Cart unavailable' })
    expect(actions.addLine).not.toHaveBeenCalled()
  })
})

describe('useCart / useCartOptional', () => {
  it('useCart throws outside the provider', () => {
    function Bare() {
      useCart()
      return null
    }
    expect(() => render(<Bare />)).toThrow(/CartProvider/)
  })

  it('useCartOptional returns null outside the provider', () => {
    function Bare() {
      return <output data-testid="optional">{String(useCartOptional())}</output>
    }
    render(<Bare />)
    expect(text('optional')).toBe('null')
  })

  it('re-exports the same hook from useCart.ts', () => {
    expect(useCart).toBe(useCartFromProvider)
  })
})

describe('CartBadge', () => {
  it('shows fallbackCount while loading, then the live count', async () => {
    const gate = deferred<Cart | null>()
    const { container } = render(
      <CartProvider actions={fakeActions({ getCart: () => gate.promise })}>
        <CartBadge fallbackCount={5} />
      </CartProvider>
    )
    const badge = () => container.querySelector('[data-cart-badge]')
    expect(badge()).toHaveTextContent('5')
    expect(badge()).toHaveAttribute('aria-hidden', 'true')

    await act(async () => {
      gate.resolve(CART)
    })
    expect(badge()).toHaveTextContent('2')
  })

  it('hides itself when the live count is 0', async () => {
    const { container } = render(
      <CartProvider initialCart={null} actions={fakeActions()}>
        <CartBadge fallbackCount={3} />
      </CartProvider>
    )
    expect(container.querySelector('[data-cart-badge]')).toBeNull()
  })

  it('uses fallbackCount outside a provider and hides at 0', () => {
    const { container, rerender } = render(<CartBadge fallbackCount={4} className="extra" />)
    expect(container.querySelector('[data-cart-badge]')).toHaveTextContent('4')
    expect(container.querySelector('[data-cart-badge]')).toHaveClass('extra')
    rerender(<CartBadge />)
    expect(container.querySelector('[data-cart-badge]')).toBeNull()
  })
})
