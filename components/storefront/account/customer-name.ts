import type { CustomerSummary } from '@/lib/shopify/types'

/**
 * Name helpers shared by server and client code (Phase 4 plan, Task 5).
 *
 * They live in their own module, without `'use client'`, because the `/account`
 * overview (a Server Component) calls `customerFirstName()` while rendering —
 * Next refuses to call a function exported from a client module on the server
 * ("Attempted to call customerFirstName() from the server but
 * customerFirstName is on the client"). `CustomerProvider` re-exports both for
 * the client-side callers (header, mobile menu).
 */

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
