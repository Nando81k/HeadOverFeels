'use client'

import * as React from 'react'
import {
  getCustomerSummaryAction,
  type CustomerLoyaltySlice,
  type CustomerSummaryState,
} from '@/app/(storefront)/_actions/account'
import type { CustomerSummary } from '@/lib/shopify/types'

/**
 * Client-side customer state for the storefront (Phase 4 plan, Task 5).
 *
 * Mirrors `CartProvider`: the slim summary is loaded once after mount through
 * `getCustomerSummaryAction()`, so catalog pages never read the session cookie
 * while rendering and stay ISR-cacheable. The header, the wishlist and the
 * cart's Care Points preview read it through `useCustomer()` /
 * `useCustomerOptional()`; the account pages themselves are server-rendered
 * from the fresh session and never depend on this.
 *
 * `status` adds `loading` to the action's own statuses. `refresh()` re-reads
 * the summary (after a profile edit, for instance) and keeps the last customer
 * on screen until the new answer lands.
 */

export type CustomerStatus = 'loading' | 'signed-out' | 'ready' | 'expired' | 'unavailable'

export type CustomerActions = {
  getSummary: () => Promise<CustomerSummaryState>
}

export type CustomerContextValue = {
  status: CustomerStatus
  customer: CustomerSummary | null
  loyalty: CustomerLoyaltySlice | null
  /** Re-read the summary. Resolves once the new state has been applied. */
  refresh(): Promise<void>
}

export interface CustomerProviderProps {
  children: React.ReactNode
  /** `hasCustomerAccountEnv()` from the server. Default true. */
  available?: boolean
  /** Inject fakes (tests). Missing entries fall back to the Server Actions. */
  actions?: Partial<CustomerActions>
}

const DEFAULT_ACTIONS: CustomerActions = {
  getSummary: getCustomerSummaryAction,
}

const SIGNED_OUT: CustomerSummaryState = { status: 'signed-out', customer: null, loyalty: null }

const CustomerContext = React.createContext<CustomerContextValue | null>(null)
CustomerContext.displayName = 'CustomerContext'

export function CustomerProvider({
  children,
  available = true,
  actions,
}: CustomerProviderProps): React.JSX.Element {
  const [state, setState] = React.useState<{
    status: CustomerStatus
    customer: CustomerSummary | null
    loyalty: CustomerLoyaltySlice | null
  }>({ status: available ? 'loading' : 'unavailable', customer: null, loyalty: null })

  const actionsRef = React.useRef<CustomerActions>({ ...DEFAULT_ACTIONS, ...actions })
  React.useEffect(() => {
    actionsRef.current = { ...DEFAULT_ACTIONS, ...actions }
  }, [actions])

  const availableRef = React.useRef(available)
  React.useEffect(() => {
    availableRef.current = available
  }, [available])

  /** Only the latest request may land, so an older answer never overwrites a newer one. */
  const requestSeq = React.useRef(0)
  const fetchStarted = React.useRef(false)

  const load = React.useCallback(async (): Promise<void> => {
    if (!availableRef.current) {
      setState({ status: 'unavailable', customer: null, loyalty: null })
      return
    }
    const seq = ++requestSeq.current
    let next: CustomerSummaryState
    try {
      next = await actionsRef.current.getSummary()
    } catch {
      // A transport failure reads as signed out: the header shows the plain
      // icon and nothing in the UI promises an account it cannot reach.
      next = SIGNED_OUT
    }
    if (seq !== requestSeq.current) return
    setState({ status: next.status, customer: next.customer, loyalty: next.loyalty })
  }, [])

  React.useEffect(() => {
    if (!available || fetchStarted.current) return
    // Ref guard rather than an effect-cleanup flag: StrictMode replays effects
    // on the same instance and the first answer must still land.
    fetchStarted.current = true
    void load()
  }, [available, load])

  const value = React.useMemo<CustomerContextValue>(
    () => ({
      status: state.status,
      customer: state.customer,
      loyalty: state.loyalty,
      refresh: load,
    }),
    [state, load]
  )

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>
}

/** The customer. Throws outside a `CustomerProvider`. */
export function useCustomer(): CustomerContextValue {
  const value = React.useContext(CustomerContext)
  if (!value) throw new Error('useCustomer() must be used inside a <CustomerProvider>.')
  return value
}

/** The customer, or `null` outside a `CustomerProvider` (header, cart fallbacks). */
export function useCustomerOptional(): CustomerContextValue | null {
  return React.useContext(CustomerContext)
}

// ---------------------------------------------------------------- name helpers

type Nameish = Pick<CustomerSummary, 'firstName' | 'lastName' | 'displayName' | 'email'>

/** "Nando" — the first name, else the display name's first word, else the email's local part. */
export function customerFirstName(customer: Nameish): string {
  const first = customer.firstName?.trim()
  if (first) return first
  const display = customer.displayName?.trim().split(/\s+/)[0]
  if (display) return display
  return customer.email.split('@')[0] || 'there'
}

/** "NA" — up to two initials from the names, else the first letter of the email. */
export function customerInitials(customer: Nameish): string {
  const parts = [customer.firstName, customer.lastName]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
  const source = parts.length > 0 ? parts : customer.displayName?.trim().split(/\s+/) ?? []
  const letters = source
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
  if (letters) return letters
  return (customer.email.charAt(0) || '?').toUpperCase()
}
