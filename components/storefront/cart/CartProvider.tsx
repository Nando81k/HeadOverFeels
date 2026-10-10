'use client'

import * as React from 'react'
import {
  addCartLine,
  applyDiscountCode,
  getCartAction,
  removeCartLine,
  removeDiscountCode,
  updateCartLine,
  updateCartNoteAction,
} from '@/app/(storefront)/_actions/cart'
import type { Cart, CartActionResult } from '@/lib/shopify/types'

/**
 * Client-side cart state for the storefront (Phase 3 plan, Task 4).
 *
 * - Loads the cart once on mount through `getCartAction()` so catalog pages
 *   never read the cart cookie while rendering (they stay ISR-cacheable).
 * - Every mutation goes through a Server Action and the returned cart replaces
 *   local state wholesale — no refetch.
 * - Quantity changes and removals are optimistic. Each in-flight edit is kept
 *   as its own pending op layered over the last server-confirmed cart, so a
 *   failure drops exactly that op (deterministic rollback) without undoing an
 *   overlapping edit that is still in flight.
 * - Owns the drawer's open state; the drawer itself is rendered by the header.
 *
 * `useCart()` is the only way UI touches the cart.
 */

export type CartStatus = 'loading' | 'ready' | 'unavailable'

export type CartActions = {
  getCart: () => Promise<Cart | null>
  addLine: (input: { variantId: string; quantity?: number }) => Promise<CartActionResult>
  updateLine: (input: { lineId: string; quantity: number }) => Promise<CartActionResult>
  removeLine: (input: { lineId: string }) => Promise<CartActionResult>
  applyCode: (input: { code: string }) => Promise<CartActionResult>
  removeCode: (input: { code: string }) => Promise<CartActionResult>
  setNote: (input: { note: string }) => Promise<CartActionResult>
}

export type CartContextValue = {
  cart: Cart | null
  status: CartStatus
  /** `cart.totalQuantity`, 0 without a cart. Reflects optimistic edits. */
  count: number
  open: boolean
  openDrawer(): void
  closeDrawer(): void
  /** True while any cart action is in flight. */
  pending: boolean
  /** Line currently being changed by `updateLine` / `removeLine`, if any. */
  pendingLineId: string | null
  error: string | null
  warning: string | null
  clearMessages(): void
  /** Opens the drawer on success unless `opts.open === false`. */
  addLine(
    input: { variantId: string; quantity?: number },
    opts?: { open?: boolean }
  ): Promise<CartActionResult>
  /** Optimistic; quantity 0 removes the line. */
  updateLine(lineId: string, quantity: number): Promise<CartActionResult>
  /** Optimistic. */
  removeLine(lineId: string): Promise<CartActionResult>
  applyCode(code: string): Promise<CartActionResult>
  removeCode(code: string): Promise<CartActionResult>
  setNote(note: string): Promise<CartActionResult>
}

export interface CartProviderProps {
  children: React.ReactNode
  /**
   * Seed state and skip the mount fetch (`null` = known empty cart). Only the
   * first value is used; later changes do not reset the provider.
   */
  initialCart?: Cart | null
  /** `hasShopifyEnv()` from the server. Default true. */
  available?: boolean
  /** Inject fakes (tests). Missing entries fall back to the Server Actions. */
  actions?: Partial<CartActions>
}

const DEFAULT_ACTIONS: CartActions = {
  getCart: getCartAction,
  addLine: addCartLine,
  updateLine: updateCartLine,
  removeLine: removeCartLine,
  applyCode: applyDiscountCode,
  removeCode: removeDiscountCode,
  setNote: updateCartNoteAction,
}

const UNAVAILABLE_ERROR = 'Cart unavailable'
const NETWORK_ERROR = 'Something went wrong updating your cart.'

type OptimisticOp = { id: number; apply: (cart: Cart) => Cart }

/** Set one line's quantity (≤ 0 drops it) and keep `totalQuantity` in step. Costs stay as-is. */
function withLineQuantity(cart: Cart, lineId: string, quantity: number): Cart {
  const target = cart.lines.find((line) => line.id === lineId)
  if (!target) return cart
  const next = Math.max(0, Math.floor(quantity))
  const lines =
    next === 0
      ? cart.lines.filter((line) => line.id !== lineId)
      : cart.lines.map((line) => (line.id === lineId ? { ...line, quantity: next } : line))
  return {
    ...cart,
    lines,
    totalQuantity: Math.max(0, cart.totalQuantity - target.quantity + next),
  }
}

const CartContext = React.createContext<CartContextValue | null>(null)
CartContext.displayName = 'CartContext'

export function CartProvider({
  children,
  initialCart,
  available = true,
  actions,
}: CartProviderProps): React.JSX.Element {
  const seeded = initialCart !== undefined

  const [serverCart, setServerCart] = React.useState<Cart | null>(initialCart ?? null)
  const [status, setStatus] = React.useState<CartStatus>(
    !available ? 'unavailable' : seeded ? 'ready' : 'loading'
  )
  const [ops, setOps] = React.useState<OptimisticOp[]>([])
  const [open, setOpen] = React.useState(false)
  const [pendingLineId, setPendingLineId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [warning, setWarning] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  // Latest actions without re-creating every callback when a caller passes a
  // fresh object literal each render.
  const actionsRef = React.useRef<CartActions>({ ...DEFAULT_ACTIONS, ...actions })
  React.useEffect(() => {
    actionsRef.current = { ...DEFAULT_ACTIONS, ...actions }
  }, [actions])

  const availableRef = React.useRef(available)
  React.useEffect(() => {
    availableRef.current = available
  }, [available])

  const opSeq = React.useRef(0)
  const fetchStarted = React.useRef(false)
  /** Set once any mutation has landed, so a slow mount fetch cannot overwrite it. */
  const mutated = React.useRef(false)

  React.useEffect(() => {
    if (!available || seeded || fetchStarted.current) return
    // A ref guard (not an effect-cleanup flag): StrictMode replays effects on
    // the same instance, and the first fetch's result must still land.
    fetchStarted.current = true
    actionsRef.current
      .getCart()
      .catch(() => null)
      .then((cart) => {
        if (!mutated.current) setServerCart(cart)
        setStatus('ready')
      })
  }, [available, seeded])

  const cart = React.useMemo(
    () => (serverCart ? ops.reduce((current, op) => op.apply(current), serverCart) : null),
    [serverCart, ops]
  )

  /**
   * Shared runner: `pending` comes from the transition, the result replaces
   * local state. Never rejects — a transport failure becomes `{ ok: false }`.
   */
  const run = React.useCallback(
    (
      call: (all: CartActions) => Promise<CartActionResult>,
      settle: (result: CartActionResult) => void
    ): Promise<CartActionResult> => {
      if (!availableRef.current) {
        setError(UNAVAILABLE_ERROR)
        return Promise.resolve({ ok: false, error: UNAVAILABLE_ERROR })
      }
      setError(null)
      setWarning(null)
      return new Promise<CartActionResult>((resolve) => {
        startTransition(async () => {
          let result: CartActionResult
          try {
            result = await call(actionsRef.current)
          } catch {
            result = { ok: false, error: NETWORK_ERROR }
          }
          if (result.ok) {
            mutated.current = true
            setServerCart(result.cart)
            setStatus((current) => (current === 'loading' ? 'ready' : current))
            setWarning(result.warning ?? null)
          } else {
            if (result.cart) {
              mutated.current = true
              setServerCart(result.cart)
            }
            setError(result.error)
          }
          settle(result)
          resolve(result)
        })
      })
    },
    []
  )

  /** Optimistic line edit: layer `apply` over the server cart until the action settles. */
  const runLineEdit = React.useCallback(
    (
      lineId: string,
      apply: (cart: Cart) => Cart,
      call: (all: CartActions) => Promise<CartActionResult>
    ): Promise<CartActionResult> => {
      if (!availableRef.current) return run(call, () => {})
      const id = ++opSeq.current
      setOps((current) => [...current, { id, apply }])
      setPendingLineId(lineId)
      return run(call, () => {
        setOps((current) => current.filter((op) => op.id !== id))
        setPendingLineId((current) => (current === lineId ? null : current))
      })
    },
    [run]
  )

  const openDrawer = React.useCallback(() => setOpen(true), [])
  const closeDrawer = React.useCallback(() => setOpen(false), [])
  const clearMessages = React.useCallback(() => {
    setError(null)
    setWarning(null)
  }, [])

  const addLine = React.useCallback<CartContextValue['addLine']>(
    (input, opts) =>
      run(
        (all) => all.addLine(input),
        (result) => {
          if (result.ok && opts?.open !== false) setOpen(true)
        }
      ),
    [run]
  )

  const updateLine = React.useCallback<CartContextValue['updateLine']>(
    (lineId, quantity) =>
      runLineEdit(
        lineId,
        (current) => withLineQuantity(current, lineId, quantity),
        (all) => all.updateLine({ lineId, quantity })
      ),
    [runLineEdit]
  )

  const removeLine = React.useCallback<CartContextValue['removeLine']>(
    (lineId) =>
      runLineEdit(
        lineId,
        (current) => withLineQuantity(current, lineId, 0),
        (all) => all.removeLine({ lineId })
      ),
    [runLineEdit]
  )

  const applyCode = React.useCallback<CartContextValue['applyCode']>(
    (code) => run((all) => all.applyCode({ code }), () => {}),
    [run]
  )
  const removeCode = React.useCallback<CartContextValue['removeCode']>(
    (code) => run((all) => all.removeCode({ code }), () => {}),
    [run]
  )
  const setNote = React.useCallback<CartContextValue['setNote']>(
    (note) => run((all) => all.setNote({ note }), () => {}),
    [run]
  )

  const value = React.useMemo<CartContextValue>(
    () => ({
      cart,
      status,
      count: cart?.totalQuantity ?? 0,
      open,
      openDrawer,
      closeDrawer,
      pending,
      pendingLineId,
      error,
      warning,
      clearMessages,
      addLine,
      updateLine,
      removeLine,
      applyCode,
      removeCode,
      setNote,
    }),
    [
      cart,
      status,
      open,
      openDrawer,
      closeDrawer,
      pending,
      pendingLineId,
      error,
      warning,
      clearMessages,
      addLine,
      updateLine,
      removeLine,
      applyCode,
      removeCode,
      setNote,
    ]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

/** The cart. Throws outside a `CartProvider`. */
export function useCart(): CartContextValue {
  const value = React.useContext(CartContext)
  if (!value) throw new Error('useCart() must be used inside a <CartProvider>.')
  return value
}

/** The cart, or `null` outside a `CartProvider` (header, PDP fallbacks). */
export function useCartOptional(): CartContextValue | null {
  return React.useContext(CartContext)
}
