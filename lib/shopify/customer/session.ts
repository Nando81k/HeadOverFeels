import 'server-only'

import type { TokenSet } from './oauth'

/**
 * STUB — Phase 4 Task 1 replaces this file in full (see the plan's Shared
 * contracts). It exists so parallel tasks can import the contract and typecheck.
 */
export const CUSTOMER_COOKIE = 'hof_customer'
export const OAUTH_STATE_COOKIE = 'hof_customer_oauth'

export type CustomerSession = {
  tokens: TokenSet
  customerId: string
  email: string
  firstName: string | null
  lastName: string | null
}

export class SignedOutError extends Error {
  constructor() {
    super('Signed out')
    this.name = 'SignedOutError'
  }
}

export async function readCustomerSession(): Promise<CustomerSession | null> {
  return null
}
export async function writeCustomerSession(_session: CustomerSession): Promise<void> {}
export async function clearCustomerSession(): Promise<void> {}
export function isAccessTokenFresh(_session: CustomerSession, _skewMs = 5 * 60_000): boolean {
  return false
}
export async function getCustomerSession(): Promise<CustomerSession | null> {
  return null
}
export async function requireFreshSession(_returnTo: string): Promise<CustomerSession> {
  throw new SignedOutError()
}
