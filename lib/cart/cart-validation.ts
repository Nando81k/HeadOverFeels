import type { CartItem } from '@/lib/store/cart'

export type CartLineValidationStatus = {
  productId: string
  variantId: string
  maxQuantity: number
  availableInventory: number
  hasProductMaxQuantity: boolean
  currentQuantity: number
  normalizedQuantity: number
  isOutOfStock: boolean
  isOverCap: boolean
  isAtCap: boolean
}

function normalizePositiveInteger(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }

  const intValue = Math.floor(value)
  if (intValue <= 0) {
    return null
  }

  return intValue
}

export function getCartLineMaxQuantity(item: CartItem): number {
  const inventoryCap = Math.max(0, Math.floor(item.variant.inventory || 0))
  const productMax = normalizePositiveInteger(item.product.maxQuantity ?? null)

  if (productMax === null) {
    return inventoryCap
  }

  return Math.min(inventoryCap, productMax)
}

export function getCartLineValidation(item: CartItem): CartLineValidationStatus {
  const availableInventory = Math.max(0, Math.floor(item.variant.inventory || 0))
  const productMax = normalizePositiveInteger(item.product.maxQuantity ?? null)
  const maxQuantity = getCartLineMaxQuantity(item)
  const currentQuantity = Math.max(0, Math.floor(item.quantity || 0))
  const normalizedQuantity = maxQuantity > 0 ? Math.min(Math.max(currentQuantity, 1), maxQuantity) : 0
  const isOutOfStock = maxQuantity <= 0 || !item.product.isActive || !item.variant.isActive
  const isOverCap = currentQuantity > maxQuantity && maxQuantity > 0

  return {
    productId: item.product.id,
    variantId: item.variant.id,
    maxQuantity,
    availableInventory,
    hasProductMaxQuantity: productMax !== null,
    currentQuantity,
    normalizedQuantity,
    isOutOfStock,
    isOverCap,
    isAtCap: !isOutOfStock && currentQuantity >= maxQuantity,
  }
}

export function hasCartBlockingIssues(lines: CartLineValidationStatus[]): boolean {
  return lines.some((line) => line.isOutOfStock || line.isOverCap)
}
