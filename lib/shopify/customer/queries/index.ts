/**
 * Public surface of the Customer Account query layer.
 *
 * Actions import from here: `import { getCustomerOrders } from '@/lib/shopify/customer/queries'`.
 * Everything returned is a plain, already-normalised domain object from
 * `lib/shopify/types.ts`; every helper takes the customer's access token first.
 */

export {
  CUSTOMER_SUMMARY_QUERY,
  CUSTOMER_UPDATE_MUTATION,
  getCustomerSummary,
  normalizeCustomerSummary,
  updateCustomer,
} from './customer'
export type { RawCustomerSummary } from './customer'

export {
  CUSTOMER_ORDER_QUERY,
  CUSTOMER_ORDERS_QUERY,
  getCustomerOrder,
  getCustomerOrders,
  normalizeOrder,
  normalizeOrderCard,
  normalizeOrdersPage,
  toFulfillmentStatus,
} from './orders'
export type {
  GetCustomerOrdersArgs,
  RawDiscountValue,
  RawFulfillment,
  RawFulfillmentStatusNode,
  RawOrder,
  RawOrderCard,
  RawOrderLine,
  RawOrderResponse,
  RawOrdersResponse,
} from './orders'

export {
  CUSTOMER_ADDRESS_CREATE_MUTATION,
  CUSTOMER_ADDRESS_DELETE_MUTATION,
  CUSTOMER_ADDRESS_UPDATE_MUTATION,
  CUSTOMER_ADDRESSES_QUERY,
  createAddress,
  deleteAddress,
  getCustomerAddresses,
  normalizeAddress,
  normalizeAddresses,
  toAddressInput,
  updateAddress,
} from './addresses'
export type { RawAddressesResponse, RawCustomerAddress, RawCustomerAddressInput } from './addresses'
