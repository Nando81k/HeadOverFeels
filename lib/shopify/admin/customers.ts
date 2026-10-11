/**
 * Admin API customer helpers (Phase 4, Task 2). Used by the pre-creation script
 * (Task 3) and kept Admin-only: the storefront identifies customers through the
 * Customer Account API, never through these.
 *
 * Documents validated 2026-10-11 (Admin 2026-07, Shopify MCP):
 *   query LoyaltyCustomerByEmail($query: String!) { customers(first: 1, query: $query) { nodes { id defaultEmailAddress { emailAddress } } } }
 *   mutation LoyaltyCustomerCreate($input: CustomerInput!) { customerCreate(input: $input) { customer { id defaultEmailAddress { emailAddress } } userErrors { field message } } }
 * `CustomerInput` fields used: email, firstName, lastName,
 * emailMarketingConsent { marketingState, marketingOptInLevel }.
 */
import { adminRequest, assertNoUserErrors } from '../admin-client'
import { ShopifyError } from '../errors'

export const CUSTOMER_BY_EMAIL_QUERY = `query LoyaltyCustomerByEmail($query: String!) { customers(first: 1, query: $query) { nodes { id defaultEmailAddress { emailAddress } } } }`

export const CUSTOMER_CREATE_MUTATION = `mutation LoyaltyCustomerCreate($input: CustomerInput!) { customerCreate(input: $input) { customer { id defaultEmailAddress { emailAddress } } userErrors { field message } } }`

export type AdminCustomer = { id: string; email: string | null }

export type CreateCustomerInput = {
  email: string
  firstName?: string | null
  lastName?: string | null
  /** true → SUBSCRIBED (single opt-in); false/undefined → NOT_SUBSCRIBED. */
  emailMarketingConsent?: boolean
}

type RawCustomer = { id: string; defaultEmailAddress: { emailAddress: string | null } | null }
type CustomersData = { customers: { nodes: RawCustomer[] } }
type CustomerCreateData = { customerCreate: { customer: RawCustomer | null } }

function toCustomer(raw: RawCustomer): AdminCustomer {
  return { id: raw.id, email: raw.defaultEmailAddress?.emailAddress ?? null }
}

/** Shopify search syntax: quote the value and escape quotes/backslashes inside it. */
export function emailSearchQuery(email: string): string {
  const escaped = email.trim().replace(/["\\]/g, (char) => `\\${char}`)
  return `email:"${escaped}"`
}

export function buildCustomerInput(input: CreateCustomerInput) {
  return {
    email: input.email.trim(),
    ...(input.firstName ? { firstName: input.firstName } : {}),
    ...(input.lastName ? { lastName: input.lastName } : {}),
    emailMarketingConsent: input.emailMarketingConsent
      ? { marketingState: 'SUBSCRIBED', marketingOptInLevel: 'SINGLE_OPT_IN' }
      : { marketingState: 'NOT_SUBSCRIBED' },
  }
}

/** The first customer whose email matches exactly, or null. */
export async function findCustomerByEmail(email: string): Promise<AdminCustomer | null> {
  const data = await adminRequest<CustomersData>(CUSTOMER_BY_EMAIL_QUERY, {
    query: emailSearchQuery(email),
  })
  const wanted = email.trim().toLowerCase()
  const match = data.customers.nodes.find(
    (node) => (node.defaultEmailAddress?.emailAddress ?? '').toLowerCase() === wanted
  )
  return match ? toCustomer(match) : null
}

export async function createCustomer(input: CreateCustomerInput): Promise<AdminCustomer> {
  const data = await adminRequest<CustomerCreateData>(CUSTOMER_CREATE_MUTATION, {
    input: buildCustomerInput(input),
  })
  assertNoUserErrors(data, 'customerCreate')
  const customer = data.customerCreate.customer
  if (!customer) throw new ShopifyError('customerCreate returned no customer')
  return toCustomer(customer)
}
