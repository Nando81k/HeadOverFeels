import 'server-only'

import type { CustomerAddress, CustomerAddressInput } from '../../types'
import { customerFetch } from '../client'
import { CustomerAccountError } from '../errors'
import { toShopifyUserErrors, type RawUserError } from './shared'

/**
 * Customer addresses (read + CRUD). Documents copied verbatim from the Phase 4
 * plan's "Validated documents" (validated 2026-10-11, `customer` schema).
 *
 * The mutation payloads only return the touched `customerAddress { id }`, so
 * `createAddress` / `updateAddress` re-read the list and return it (the
 * actions hand the fresh list to the page); `deleteAddress` returns the
 * deleted id and the action re-reads. `userErrors` become a
 * `CustomerAccountError(firstMessage, { userErrors, code })`.
 */

// ---------------------------------------------------------------- documents

export const CUSTOMER_ADDRESSES_QUERY =
  'query CustomerAddresses { customer { defaultAddress { id } addresses(first: 20) { nodes { id firstName lastName company address1 address2 city province zoneCode territoryCode zip phoneNumber formatted } } } }'

export const CUSTOMER_ADDRESS_CREATE_MUTATION =
  'mutation CustomerAddressCreate($address: CustomerAddressInput!, $defaultAddress: Boolean) { customerAddressCreate(address: $address, defaultAddress: $defaultAddress) { customerAddress { id } userErrors { field message code } } }'

export const CUSTOMER_ADDRESS_UPDATE_MUTATION =
  'mutation CustomerAddressUpdate($addressId: ID!, $address: CustomerAddressInput, $defaultAddress: Boolean) { customerAddressUpdate(addressId: $addressId, address: $address, defaultAddress: $defaultAddress) { customerAddress { id } userErrors { field message code } } }'

export const CUSTOMER_ADDRESS_DELETE_MUTATION =
  'mutation CustomerAddressDelete($addressId: ID!) { customerAddressDelete(addressId: $addressId) { deletedAddressId userErrors { field message code } } }'

// ---------------------------------------------------------------- raw shapes

export type RawCustomerAddress = {
  id: string
  firstName: string | null
  lastName: string | null
  company: string | null
  address1: string | null
  address2: string | null
  city: string | null
  province: string | null
  zoneCode: string | null
  territoryCode: string | null
  zip: string | null
  phoneNumber: string | null
  formatted: string[] | null
}

export type RawAddressesResponse = {
  customer: {
    defaultAddress: { id: string } | null
    addresses: { nodes: RawCustomerAddress[] } | null
  } | null
}

type RawAddressMutationPayload = {
  customerAddress?: { id: string } | null
  deletedAddressId?: string | null
  userErrors: RawUserError[] | null
}

/** The wire shape of the API's `CustomerAddressInput` (note `phoneNumber`, not `phone`). */
export type RawCustomerAddressInput = {
  firstName: string | null
  lastName: string | null
  company: string | null
  address1: string | null
  address2: string | null
  city: string | null
  zoneCode: string | null
  territoryCode: string | null
  zip: string | null
  phoneNumber: string | null
}

// ---------------------------------------------------------------- normalisers

export function normalizeAddress(raw: RawCustomerAddress, defaultId: string | null): CustomerAddress {
  return {
    id: raw.id,
    firstName: raw.firstName ?? null,
    lastName: raw.lastName ?? null,
    company: raw.company ?? null,
    address1: raw.address1 ?? null,
    address2: raw.address2 ?? null,
    city: raw.city ?? null,
    zoneCode: raw.zoneCode ?? null,
    territoryCode: raw.territoryCode ?? null,
    zip: raw.zip ?? null,
    phone: raw.phoneNumber ?? null,
    formatted: raw.formatted ?? [],
    isDefault: defaultId !== null && raw.id === defaultId,
  }
}

export function normalizeAddresses(raw: RawAddressesResponse): CustomerAddress[] {
  const customer = raw.customer
  if (!customer) return []
  const defaultId = customer.defaultAddress?.id ?? null
  return (customer.addresses?.nodes ?? []).map((node) => normalizeAddress(node, defaultId))
}

export function toAddressInput(input: CustomerAddressInput): RawCustomerAddressInput {
  return {
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    company: input.company ?? null,
    address1: input.address1 ?? null,
    address2: input.address2 ?? null,
    city: input.city ?? null,
    zoneCode: input.zoneCode ?? null,
    territoryCode: input.territoryCode ?? null,
    zip: input.zip ?? null,
    phoneNumber: input.phone ?? null,
  }
}

// ---------------------------------------------------------------- fetchers

export async function getCustomerAddresses(token: string): Promise<CustomerAddress[]> {
  const data = await customerFetch<RawAddressesResponse>(CUSTOMER_ADDRESSES_QUERY, { accessToken: token })
  return normalizeAddresses(data)
}

async function runAddressMutation(
  token: string,
  document: string,
  root: string,
  variables: Record<string, unknown>
): Promise<RawAddressMutationPayload> {
  const data = await customerFetch<Record<string, RawAddressMutationPayload | null>>(document, {
    accessToken: token,
    variables,
  })
  const payload = data[root]
  if (!payload) throw new CustomerAccountError(`Shopify ${root} returned no payload`)

  const userErrors = payload.userErrors ?? []
  if (userErrors.length > 0) {
    throw new CustomerAccountError(userErrors[0].message, {
      userErrors: toShopifyUserErrors(userErrors),
      code: userErrors[0].code ?? undefined,
    })
  }
  return payload
}

function withDefaultFlag(
  variables: Record<string, unknown>,
  defaultAddress: boolean | undefined
): Record<string, unknown> {
  return defaultAddress === undefined ? variables : { ...variables, defaultAddress }
}

/** Creates the address and returns the refreshed list. */
export async function createAddress(token: string, input: CustomerAddressInput): Promise<CustomerAddress[]> {
  await runAddressMutation(
    token,
    CUSTOMER_ADDRESS_CREATE_MUTATION,
    'customerAddressCreate',
    withDefaultFlag({ address: toAddressInput(input) }, input.defaultAddress)
  )
  return getCustomerAddresses(token)
}

/** Updates the address and returns the refreshed list. */
export async function updateAddress(
  token: string,
  addressId: string,
  input: CustomerAddressInput
): Promise<CustomerAddress[]> {
  await runAddressMutation(
    token,
    CUSTOMER_ADDRESS_UPDATE_MUTATION,
    'customerAddressUpdate',
    withDefaultFlag({ addressId, address: toAddressInput(input) }, input.defaultAddress)
  )
  return getCustomerAddresses(token)
}

/** Deletes the address and returns the deleted id. */
export async function deleteAddress(token: string, addressId: string): Promise<string> {
  const payload = await runAddressMutation(token, CUSTOMER_ADDRESS_DELETE_MUTATION, 'customerAddressDelete', {
    addressId,
  })
  return payload.deletedAddressId ?? addressId
}
