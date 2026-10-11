/**
 * Account UI (Phase 4, Task 5).
 *
 * Everything here is safe to import from either side of the client boundary.
 * Two modules are deliberately NOT re-exported because they import the
 * server-only session layer or Prisma — import them directly from their files
 * in server components only:
 *
 * - `./AccountShell` (`AccountShell`, `renderAccountPage`)
 * - `./EarlierOrders` (`EarlierOrders`, `EarlierOrdersList`, `loadEarlierOrders`)
 */

export {
  CustomerProvider,
  customerFirstName,
  customerInitials,
  useCustomer,
  useCustomerOptional,
  type CustomerActions,
  type CustomerContextValue,
  type CustomerProviderProps,
  type CustomerStatus,
} from './CustomerProvider'

export {
  ACCOUNT_MENU_ITEMS,
  ACCOUNT_NAV_ITEMS,
  AccountNav,
  isActiveAccountPath,
  LOGOUT_ACTION,
  SignOutForm,
  type AccountNavItem,
  type AccountNavProps,
  type SignOutFormProps,
} from './AccountNav'

export {
  SIGN_IN_GATE_MESSAGE,
  SIGN_IN_GATE_TITLE,
  SignInGate,
  signInHref,
  type SignInGateProps,
} from './SignInGate'

export {
  ACCOUNT_UNAVAILABLE_MESSAGE,
  ACCOUNT_UNAVAILABLE_TITLE,
  AccountUnavailable,
  type AccountUnavailableProps,
} from './AccountUnavailable'

export {
  FULFILLMENT_LABEL,
  formatOrderDate,
  OrderCard,
  orderGidFromId,
  orderIdFromGid,
  orderPath,
  OrderStatusBadge,
  type OrderCardProps,
} from './OrderCard'
export { OrderList, type LoadMoreOrders, type OrderListProps } from './OrderList'
export { formatDiscount, OrderDetail, type OrderDetailProps } from './OrderDetail'
export {
  FulfillmentTimeline,
  timelineSteps,
  type FulfillmentTimelineProps,
  type TimelineStep,
  type TimelineStepKey,
  type TimelineStepState,
} from './FulfillmentTimeline'

export {
  AddressBook,
  AddressCard,
  type AddressBookActions,
  type AddressBookProps,
  type AddressCardProps,
} from './AddressCard'
export { ADDRESS_COUNTRIES, AddressForm, type AddressFormAction, type AddressFormProps } from './AddressForm'
export { DROP_ALERTS_TITLE, ProfileForm, type ProfileFormAction, type ProfileFormProps } from './ProfileForm'
