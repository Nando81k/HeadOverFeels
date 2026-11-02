/**
 * The customer hooks, importable without pulling the provider component into
 * a consumer's mental model. `useCustomer()` throws outside a
 * `CustomerProvider`; `useCustomerOptional()` returns `null` there.
 */
export { useCustomer, useCustomerOptional } from './CustomerProvider'
export type { CustomerContextValue, CustomerStatus } from './CustomerProvider'
