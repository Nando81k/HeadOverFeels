import { prisma } from '@/lib/prisma'

export const SHIPPING_RATES = {
  STANDARD: 10,
  EXPRESS: 25,
  OVERNIGHT: 45,
} as const

export const FREE_SHIPPING_THRESHOLD = 100
export const TAX_RATE = 0.08

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

interface PricingItem {
  productId: string
  productVariantId?: string
  quantity: number
}

export interface OrderPricing {
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
  freeShipping: boolean
}

export async function computeOrderPricing(
  tx: TxClient,
  params: {
    items: PricingItem[]
    shippingMethod?: string
    redemptionId?: string
    promotionId?: string
    customerId?: string | null
  }
): Promise<OrderPricing> {
  const { items, shippingMethod, redemptionId, promotionId, customerId } = params

  // 1. Fetch authoritative prices from DB
  const enriched = await Promise.all(
    items.map(async (item) => {
      let unitPrice: number

      if (item.productVariantId) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.productVariantId },
          select: { price: true, product: { select: { price: true } } },
        })
        unitPrice = variant?.price ?? variant?.product.price ?? 0
      } else {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { price: true },
        })
        unitPrice = product?.price ?? 0
      }

      return item.quantity * unitPrice
    })
  )

  const subtotal = enriched.reduce((sum, line) => sum + line, 0)

  // 2. Resolve discount from loyalty redemption or marketing promotion
  let discount = 0
  let hasFreeShippingCoupon = false

  if (redemptionId) {
    const redemption = await tx.rewardRedemption.findUnique({
      where: { id: redemptionId },
      include: { reward: true },
    })

    if (redemption && !redemption.usedAt && redemption.reward.isActive) {
      switch (redemption.reward.rewardType) {
        case 'DISCOUNT':
          discount = Math.min(redemption.reward.value ?? 0, subtotal)
          break
        case 'FREE_SHIPPING':
          hasFreeShippingCoupon = true
          break
        default:
          break
      }
    }
  }

  if (promotionId && discount === 0) {
    const promotion = await tx.promotion.findUnique({
      where: { id: promotionId },
    })

    if (promotion && promotion.isActive) {
      switch (promotion.type) {
        case 'PERCENTAGE':
          discount = subtotal * (promotion.value / 100)
          if (promotion.maxDiscountPercent) {
            discount = Math.min(discount, subtotal * (promotion.maxDiscountPercent / 100))
          }
          break
        case 'FIXED_AMOUNT':
          discount = Math.min(promotion.value, subtotal)
          break
        case 'FREE_SHIPPING':
          hasFreeShippingCoupon = true
          break
        default:
          break
      }
    }
  }

  // 3. Determine shipping rate
  const method = (shippingMethod?.toUpperCase() ?? 'STANDARD') as keyof typeof SHIPPING_RATES
  const baseRate = SHIPPING_RATES[method] ?? SHIPPING_RATES.STANDARD

  // Check if customer's loyalty tier grants free shipping
  let hasTierFreeShipping = false
  if (customerId) {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { loyaltyTier: { select: { freeShipping: true } }, isAdmin: true },
    })
    hasTierFreeShipping = customer?.loyaltyTier?.freeShipping === true || customer?.isAdmin === true
  }

  const qualifiesForFreeStandard =
    hasTierFreeShipping || hasFreeShippingCoupon || subtotal >= FREE_SHIPPING_THRESHOLD

  const shipping =
    method === 'STANDARD' && qualifiesForFreeStandard ? 0 : baseRate

  // 4. Tax on discounted subtotal
  const discountedSubtotal = subtotal - discount
  const tax = discountedSubtotal * TAX_RATE
  const total = Math.max(0, discountedSubtotal + shipping + tax)

  return {
    subtotal,
    discount,
    shipping,
    tax,
    total,
    freeShipping: shipping === 0,
  }
}
