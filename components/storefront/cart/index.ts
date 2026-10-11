/**
 * Cart UI parts (Phase 3, Task 5). The provider and hooks (`CartProvider`,
 * `useCart`, `useCartOptional`, `CartBadge`) are T4's and are imported from
 * their own modules, not re-exported here.
 */
export { CartDrawer } from './CartDrawer'
export {
  CartLineItem,
  DEFAULT_LINE_MAX,
  formatLineOptions,
  lineMaxQuantity,
  type CartLineItemProps,
} from './CartLineItem'
export { CartLines, type CartLinesProps } from './CartLines'
export { CartSummary, carePointsFor, type CartSummaryProps } from './CartSummary'
export {
  CheckoutButtons,
  isCheckoutBlocked,
  shopPayHref,
  type CheckoutButtonsProps,
} from './CheckoutButtons'
export { DiscountCodeForm, type DiscountCodeFormProps } from './DiscountCodeForm'
export { EmptyCart, type EmptyCartProps } from './EmptyCart'
export { FreeShippingBar, type FreeShippingBarProps } from './FreeShippingBar'
