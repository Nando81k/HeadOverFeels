/**
 * Promotion Validation & Stacking Prevention Service
 * 
 * Prevents customers from combining non-stackable promotions
 * and caps total discounts for profit protection.
 */

import { prisma } from '@/lib/prisma'
import type { Promotion, PromotionType } from '@prisma/client'

export interface PromoValidationInput {
  code: string
  cartTotal: number
  productIds?: string[]
  collectionIds?: string[]
  customerEmail?: string
  customerId?: string
  currentPromotions?: AppliedPromotion[] // Already applied promos
}

export interface AppliedPromotion {
  id: string
  code: string
  type: PromotionType
  value: number
  discount: number
  stackable: boolean
  excludeFromLoyalty: boolean
}

export interface PromoValidationResult {
  valid: boolean
  error?: string
  promotion?: {
    id: string
    name: string
    code: string
    type: PromotionType
    value: number
    discount: number
    discountDescription: string
    freeShipping: boolean
    stackable: boolean
    excludeFromLoyalty: boolean
  }
  warnings?: string[]
}

export interface StackValidationResult {
  canStack: boolean
  error?: string
  totalDiscount: number
  cappedDiscount: number
  appliedCap?: number
  excludeLoyaltyPoints: boolean
}

/**
 * Validate a promotion code with stacking rules
 */
export async function validatePromotion(
  input: PromoValidationInput
): Promise<PromoValidationResult> {
  const { code, cartTotal, productIds, collectionIds, customerEmail, customerId, currentPromotions = [] } = input
  const warnings: string[] = []

  if (!code) {
    return { valid: false, error: 'Promotion code is required' }
  }

  // Find the promotion
  const promotion = await prisma.promotion.findUnique({
    where: { code: code.toUpperCase() }
  })

  if (!promotion) {
    return { valid: false, error: 'Invalid promotion code' }
  }

  // Basic validation checks
  const basicValidation = validateBasicRequirements(promotion, cartTotal)
  if (!basicValidation.valid) {
    return basicValidation
  }

  // Check targeting
  const targetingValidation = validateTargeting(promotion, productIds, collectionIds, customerEmail)
  if (!targetingValidation.valid) {
    return targetingValidation
  }

  // Check per-customer usage limit
  if (promotion.maxUsesPerCustomer && customerId) {
    const usageCount = await getCustomerPromoUsage(promotion.id, customerId)
    if (usageCount >= promotion.maxUsesPerCustomer) {
      return { valid: false, error: 'You have already used this promotion the maximum number of times' }
    }
  }

  // Check stacking compatibility
  if (currentPromotions.length > 0) {
    const stackingResult = validateStacking(promotion, currentPromotions)
    if (!stackingResult.canStack) {
      return { valid: false, error: stackingResult.error }
    }
    if (stackingResult.error) {
      warnings.push(stackingResult.error)
    }
  }

  // Calculate discount
  const { discount, discountDescription } = calculateDiscount(promotion, cartTotal, productIds)

  return {
    valid: true,
    promotion: {
      id: promotion.id,
      name: promotion.name,
      code: promotion.code!,
      type: promotion.type,
      value: promotion.value,
      discount,
      discountDescription,
      freeShipping: promotion.type === 'FREE_SHIPPING',
      stackable: promotion.stackable,
      excludeFromLoyalty: promotion.excludeFromLoyalty,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Validate basic promotion requirements (active, dates, usage limits)
 */
function validateBasicRequirements(
  promotion: Promotion,
  cartTotal: number
): PromoValidationResult {
  // Check if active
  if (!promotion.isActive) {
    return { valid: false, error: 'This promotion is no longer active' }
  }

  // Check date range
  const now = new Date()
  if (promotion.startDate > now) {
    return { valid: false, error: 'This promotion has not started yet' }
  }

  if (promotion.endDate && promotion.endDate < now) {
    return { valid: false, error: 'This promotion has expired' }
  }

  // Check total usage limits
  if (promotion.maxUsesTotal && promotion.usedCount >= promotion.maxUsesTotal) {
    return { valid: false, error: 'This promotion has reached its usage limit' }
  }

  // Check minimum purchase
  if (promotion.minimumPurchase && cartTotal < promotion.minimumPurchase) {
    return { 
      valid: false, 
      error: `Minimum purchase of $${promotion.minimumPurchase.toFixed(2)} required` 
    }
  }

  return { valid: true }
}

/**
 * Validate product/collection/customer targeting
 */
function validateTargeting(
  promotion: Promotion,
  productIds?: string[],
  collectionIds?: string[],
  customerEmail?: string
): PromoValidationResult {
  // Check product targeting
  if (promotion.productIds && productIds) {
    try {
      const targetedProducts: string[] = JSON.parse(promotion.productIds)
      const hasTargetedProduct = productIds.some(id => targetedProducts.includes(id))
      if (!hasTargetedProduct) {
        return { valid: false, error: 'This promotion does not apply to items in your cart' }
      }
    } catch {
      // Invalid JSON, skip this check
    }
  }

  // Check collection targeting
  if (promotion.collectionIds && collectionIds) {
    try {
      const targetedCollections: string[] = JSON.parse(promotion.collectionIds)
      const hasTargetedCollection = collectionIds.some(id => targetedCollections.includes(id))
      if (!hasTargetedCollection) {
        return { valid: false, error: 'This promotion does not apply to items in your cart' }
      }
    } catch {
      // Invalid JSON, skip this check
    }
  }

  // Check customer email targeting
  if (promotion.customerEmails && customerEmail) {
    try {
      const targetedEmails: string[] = JSON.parse(promotion.customerEmails)
      if (!targetedEmails.map(e => e.toLowerCase()).includes(customerEmail.toLowerCase())) {
        return { valid: false, error: 'This promotion is not available for your account' }
      }
    } catch {
      // Invalid JSON, skip this check
    }
  }

  return { valid: true }
}

/**
 * Validate stacking rules between promotions
 */
function validateStacking(
  newPromo: Promotion,
  currentPromos: AppliedPromotion[]
): { canStack: boolean; error?: string } {
  // If new promo is not stackable and we already have promos
  if (!newPromo.stackable && currentPromos.length > 0) {
    return { 
      canStack: false, 
      error: 'This promotion cannot be combined with other promotions' 
    }
  }

  // Check if any current promo is non-stackable
  const nonStackablePromo = currentPromos.find(p => !p.stackable)
  if (nonStackablePromo) {
    return { 
      canStack: false, 
      error: `Cannot add more promotions - "${nonStackablePromo.code}" cannot be combined with other codes` 
    }
  }

  // Prevent duplicate promo codes
  if (currentPromos.some(p => p.id === newPromo.id)) {
    return { canStack: false, error: 'This promotion code has already been applied' }
  }

  // Prevent same-type stacking for certain types (e.g., can't stack two % discounts)
  const sameTypePromo = currentPromos.find(p => p.type === newPromo.type)
  if (sameTypePromo && (newPromo.type === 'PERCENTAGE' || newPromo.type === 'FIXED_AMOUNT')) {
    return { 
      canStack: false, 
      error: `Cannot combine multiple ${newPromo.type === 'PERCENTAGE' ? 'percentage' : 'fixed amount'} discounts` 
    }
  }

  return { canStack: true }
}

/**
 * Calculate the actual discount amount
 */
function calculateDiscount(
  promotion: Promotion,
  cartTotal: number,
  _productIds?: string[]
): { discount: number; discountDescription: string } {
  let discount = 0
  let discountDescription = ''

  switch (promotion.type) {
    case 'PERCENTAGE':
      discount = cartTotal * (promotion.value / 100)
      discountDescription = `${promotion.value}% off`
      break
    case 'FIXED_AMOUNT':
      discount = Math.min(promotion.value, cartTotal)
      discountDescription = `$${promotion.value.toFixed(2)} off`
      break
    case 'FREE_SHIPPING':
      discount = 0 // Shipping discount handled separately
      discountDescription = 'Free shipping'
      break
    case 'BOGO':
      discountDescription = 'Buy One Get One'
      // BOGO discount calculated based on second-lowest priced item
      break
    case 'BUY_X_GET_Y':
      discountDescription = `Buy more, save ${promotion.value}%`
      break
  }

  return { discount, discountDescription }
}

/**
 * Get customer's usage count for a specific promotion
 */
async function getCustomerPromoUsage(promotionId: string, customerId: string): Promise<number> {
  // First get the promo code for this promotion
  const promo = await prisma.promotion.findUnique({
    where: { id: promotionId },
    select: { code: true },
  })
  
  if (!promo?.code) {
    return 0
  }
  
  // Count orders that used this coupon code
  const count = await prisma.order.count({
    where: {
      customerId,
      couponCode: promo.code,
      status: {
        notIn: ['CANCELLED', 'REFUNDED'],
      },
    },
  })
  
  return count
}

/**
 * Calculate total discount with stacking and caps applied
 */
export function calculateStackedDiscount(
  appliedPromos: AppliedPromotion[],
  cartTotal: number,
  globalMaxDiscountPercent?: number // Optional global cap (e.g., 60% max)
): StackValidationResult {
  if (appliedPromos.length === 0) {
    return {
      canStack: true,
      totalDiscount: 0,
      cappedDiscount: 0,
      excludeLoyaltyPoints: false,
    }
  }

  // Sum up all discounts
  const totalDiscount = appliedPromos.reduce((sum, promo) => sum + promo.discount, 0)

  // Find the most restrictive cap from applied promos
  const promoCaps = appliedPromos
    .map(p => {
      // Look up full promo details for cap
      return p // In real usage, we'd fetch maxDiscountPercent
    })

  // Apply global cap if set
  const maxDiscountAmount = globalMaxDiscountPercent 
    ? cartTotal * (globalMaxDiscountPercent / 100)
    : cartTotal * 0.75 // Default 75% max discount for profit protection

  const cappedDiscount = Math.min(totalDiscount, maxDiscountAmount)

  // Check if any promo excludes from loyalty
  const excludeLoyaltyPoints = appliedPromos.some(p => p.excludeFromLoyalty)

  return {
    canStack: true,
    totalDiscount,
    cappedDiscount,
    appliedCap: cappedDiscount < totalDiscount ? (cappedDiscount / cartTotal) * 100 : undefined,
    excludeLoyaltyPoints,
  }
}

/**
 * Get all currently active auto-apply promotions
 */
export async function getAutoApplyPromotions(
  cartTotal: number,
  productIds?: string[],
  collectionIds?: string[],
  customerEmail?: string
): Promise<AppliedPromotion[]> {
  const now = new Date()

  const autoPromos = await prisma.promotion.findMany({
    where: {
      autoApply: true,
      isActive: true,
      startDate: { lte: now },
      AND: [
        {
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
      ],
    },
  })
  
  // Filter by usage limits in memory since Prisma can't compare fields
  const filteredPromos = autoPromos.filter(promo => {
    if (promo.maxUsesTotal === null) return true
    return promo.usedCount < promo.maxUsesTotal
  })

  const validPromos: AppliedPromotion[] = []

  for (const promo of filteredPromos) {
    // Check minimum purchase
    if (promo.minimumPurchase && cartTotal < promo.minimumPurchase) {
      continue
    }

    // Check targeting
    const targetingResult = validateTargeting(promo, productIds, collectionIds, customerEmail)
    if (!targetingResult.valid) {
      continue
    }

    // Check stacking with already valid promos
    if (validPromos.length > 0) {
      const stackResult = validateStacking(promo, validPromos)
      if (!stackResult.canStack) {
        continue
      }
    }

    const { discount, discountDescription } = calculateDiscount(promo, cartTotal, productIds)

    validPromos.push({
      id: promo.id,
      code: promo.code || `AUTO-${promo.id}`,
      type: promo.type,
      value: promo.value,
      discount,
      stackable: promo.stackable,
      excludeFromLoyalty: promo.excludeFromLoyalty,
    })
  }

  return validPromos
}

/**
 * Validate that a promotion doesn't overlap with other active promotions
 * (for admin use when creating/editing promotions)
 */
export async function checkPromoOverlap(
  promoId: string | null, // null for new promo
  startDate: Date,
  endDate: Date | null,
  type: PromotionType,
  productIds?: string[],
  collectionIds?: string[]
): Promise<{ hasOverlap: boolean; overlappingPromos: { id: string; name: string; code: string | null }[] }> {
  const overlapping = await prisma.promotion.findMany({
    where: {
      id: promoId ? { not: promoId } : undefined, // Exclude self when editing
      isActive: true,
      type, // Same type promos
      stackable: false, // Only check non-stackable
      // Date overlap check
      AND: [
        { startDate: { lte: endDate || new Date('2099-12-31') } },
        {
          OR: [
            { endDate: null },
            { endDate: { gte: startDate } },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      code: true,
      productIds: true,
      collectionIds: true,
    },
  })

  // Further filter by product/collection overlap
  const actuallyOverlapping = overlapping.filter(promo => {
    // If neither has targeting, they overlap
    if (!promo.productIds && !promo.collectionIds && !productIds && !collectionIds) {
      return true
    }

    // Check product overlap
    if (promo.productIds && productIds) {
      try {
        const promoProducts: string[] = JSON.parse(promo.productIds)
        if (productIds.some(id => promoProducts.includes(id))) {
          return true
        }
      } catch {
        // Invalid JSON
      }
    }

    // Check collection overlap
    if (promo.collectionIds && collectionIds) {
      try {
        const promoCollections: string[] = JSON.parse(promo.collectionIds)
        if (collectionIds.some(id => promoCollections.includes(id))) {
          return true
        }
      } catch {
        // Invalid JSON
      }
    }

    return false
  })

  return {
    hasOverlap: actuallyOverlapping.length > 0,
    overlappingPromos: actuallyOverlapping.map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
    })),
  }
}
