import 'server-only'

import type { CustomerAddress, CustomerSummary } from '../../types'
import { customerFetch } from '../client'
import { CustomerAccountError } from '../errors'
import { toShopifyUserErrors, type RawUserError } from './shared'

/**
 * Customer summary + profile update. Documents copied verbatim from the Phase 4
 * plan's "Validated documents" (validated 2026-10-11 against the `customer`
 * schema). Every call is per customer and `no-store` (see `../client.ts`).
 *
 * The summary document selects only `id` + `formatted` on `defaultAddress`,
 * so the normalised `CustomerSummary.defaultAddress` carries those two fields
 * and `isDefault: true`; the structured fields are `null` until
 * `getCustomerAddresses` is used (its document selects them all).
 */

// ---------------------------------------------------------------- documents

export const CUSTOMER_SUMMARY_QUERY =
  'query CustomerSummary { customer { id emailAddress { emailAddress } firstName lastName displayName phoneNumber { phoneNumber } defaultAddress { id formatted } } }'

export const CUSTOMER_UPDATE_MUTATION =
  'mutation CustomerUpdate($input: CustomerUpdateInput!) { customerUpdate(input: $input) { customer { id firstName lastName } userErrors { field message code } } }'

// ---------------------------------------------------------------- raw shapes

export type RawCustomerSummary = {
  customer: {
    id: string
    emailAddress: { emailAddress: string | null } | null
    firstName: string | null
    lastName: string | null
    displayName: string | null
    phoneNumber: { phoneNumber: string | null } | null
    defaultAddress: { id: string; formatted: string[] | null } | null
  } | null
}

type RawCustomerUpdatePayload = {
  customerUpdate: {
    customer: { id: string; firstName: string | null; lastName: string | null } | null
    userErrors: RawUserError[] | null
  } | null
}

// ---------------------------------------------------------------- normaliser

function emptyAddress(id: string, formatted: string[] | null): CustomerAddress {
  return {
    id,
    firstName: null,
    lastName: null,
    company: null,
    address1: null,
    address2: null,
    city: null,
    zoneCode: null,
    territoryCode: null,
    zip: null,
    phone: null,
    formatted: formatted ?? [],
    isDefault: true,
  }
}

export function normalizeCustomerSummary(raw: RawCustomerSummary): CustomerSummary {
  const customer = raw.customer
  if (!customer) throw new CustomerAccountError('Customer Account API returned no customer')
  return {
    id: customer.id,
    email: customer.emailAddress?.emailAddress ?? '',
    firstName: customer.firstName ?? null,
    lastName: customer.lastName ?? null,
    displayName: customer.displayName ?? '',
    phone: customer.phoneNumber?.phoneNumber ?? null,
    defaultAddress: customer.defaultAddress
      ? emptyAddress(customer.defaultAddress.id, customer.defaultAddress.formatted)
      : null,
  }
}

// ---------------------------------------------------------------- fetchers

export async function getCustomerSummary(token: string): Promise<CustomerSummary> {
  const data = await customerFetch<RawCustomerSummary>(CUSTOMER_SUMMARY_QUERY, { accessToken: token })
  return normalizeCustomerSummary(data)
}

/** Updates the names, then returns the refreshed summary (the mutation payload is slim). */
export async function updateCustomer(
  token: string,
  input: { firstName: string; lastName: string }
): Promise<CustomerSummary> {
  const data = await customerFetch<RawCustomerUpdatePayload>(CUSTOMER_UPDATE_MUTATION, {
    accessToken: token,
    variables: { input: { firstName: input.firstName, lastName: input.lastName } },
  })
  const payload = data.customerUpdate
  if (!payload) throw new CustomerAccountError('Shopify customerUpdate returned no payload')

  const userErrors = payload.userErrors ?? []
  if (userErrors.length > 0) {
    throw new CustomerAccountError(userErrors[0].message, {
      userErrors: toShopifyUserErrors(userErrors),
      code: userErrors[0].code ?? undefined,
    })
  }

  return getCustomerSummary(token)
}
