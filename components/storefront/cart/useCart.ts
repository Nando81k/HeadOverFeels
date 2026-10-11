/**
 * The cart hooks, importable without pulling the provider component into a
 * consumer's mental model. `useCart()` throws outside a `CartProvider`;
 * `useCartOptional()` returns `null` there.
 */
export { useCart, useCartOptional } from './CartProvider'
export type { CartContextValue, CartStatus } from './CartProvider'
