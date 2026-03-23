import type { Product, ProductVariant } from '@/lib/api/products'

export type WishlistAddToCartResolutionOutcome =
  | 'added'
  | 'requiresSelection'
  | 'outOfStock'
  | 'skipped'

export type WishlistQuickAddVariant = {
  id: string
  sku: string
  size?: string | null
  color?: string | null
  colorHex?: string | null
  images?: string | null
  price?: number | null
  inventory: number
  isActive: boolean
}

export type WishlistQuickAddItem = {
  product: {
    id: string
    name: string
    slug: string
    price: number
    images: string
    isActive: boolean
    compareAtPrice?: number | null
    category?: Product['category']
    maxQuantity?: number | null
  }
  productVariant?: WishlistQuickAddVariant | null
}

export type WishlistQuickAddResolution = {
  outcome: WishlistAddToCartResolutionOutcome
  product: Product
  variant?: ProductVariant
  reason?: string
}

function toCartProduct(baseProduct: WishlistQuickAddItem['product'], variants: ProductVariant[]): Product {
  return {
    id: baseProduct.id,
    name: baseProduct.name,
    slug: baseProduct.slug,
    price: baseProduct.price,
    compareAtPrice: baseProduct.compareAtPrice ?? undefined,
    images: baseProduct.images,
    isActive: baseProduct.isActive,
    isFeatured: false,
    maxQuantity: baseProduct.maxQuantity ?? null,
    category: baseProduct.category,
    variants,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }
}

function toCartVariant(variant: WishlistQuickAddVariant): ProductVariant {
  return {
    id: variant.id,
    sku: variant.sku,
    size: variant.size || undefined,
    color: variant.color || undefined,
    colorHex: variant.colorHex || undefined,
    images: variant.images || undefined,
    price: variant.price ?? undefined,
    inventory: variant.inventory,
    isActive: variant.isActive,
  }
}

function isSellableVariant(variant: ProductVariant | WishlistQuickAddVariant): boolean {
  return variant.isActive && variant.inventory > 0
}

export function resolveWishlistQuickAdd(
  item: WishlistQuickAddItem,
  productDetail?: Product
): WishlistQuickAddResolution {
  const fallbackProduct = toCartProduct(item.product, [])

  if (!item.product.isActive) {
    return {
      outcome: 'outOfStock',
      product: fallbackProduct,
      reason: 'Product is inactive',
    }
  }

  if (item.productVariant) {
    const chosenVariant = toCartVariant(item.productVariant)
    const product = toCartProduct(item.product, [chosenVariant])

    if (!isSellableVariant(chosenVariant)) {
      return {
        outcome: 'outOfStock',
        product,
        reason: 'Saved variant is out of stock',
      }
    }

    return {
      outcome: 'added',
      product,
      variant: chosenVariant,
    }
  }

  if (!productDetail) {
    return {
      outcome: 'requiresSelection',
      product: fallbackProduct,
      reason: 'Variant data required',
    }
  }

  const activeInStockVariants = productDetail.variants.filter(isSellableVariant)

  if (activeInStockVariants.length === 0) {
    return {
      outcome: 'outOfStock',
      product: productDetail,
      reason: 'No in-stock variants',
    }
  }

  if (activeInStockVariants.length === 1) {
    return {
      outcome: 'added',
      product: productDetail,
      variant: activeInStockVariants[0],
    }
  }

  return {
    outcome: 'requiresSelection',
    product: productDetail,
    reason: 'Multiple variants available',
  }
}
