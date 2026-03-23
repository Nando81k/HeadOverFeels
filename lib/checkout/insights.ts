import { TIER_HIERARCHY } from '@/lib/loyalty/tier-progress'

export interface CheckoutTierInfo {
  name: string
  slug: string
  minAnnualPoints: number
  pointMultiplier: number
}

export interface CheckoutLoyaltyPreviewInput {
  orderTotal: number
  currentPoints: number
  annualPointsEarned: number
  pointMultiplier: number
  activeEventMultiplier: number
  currentTierSlug?: string | null
  tiers?: CheckoutTierInfo[]
}

export interface CheckoutLoyaltyPreview {
  basePoints: number
  eventBonusPoints: number
  tierBonusPoints: number
  totalPoints: number
  projectedCurrentPoints: number
  projectedAnnualPoints: number
  currentTier: CheckoutTierInfo
  projectedTier: CheckoutTierInfo
  nextTierAfterPurchase: CheckoutTierInfo | null
  pointsToNextTierAfterPurchase: number
  willUpgradeTier: boolean
}

export interface CheckoutSavingsInput {
  subtotal: number
  discount: number
  shipping: number
  baseShippingPrice: number
  tax: number
  taxRate: number
}

export interface CheckoutSavingsBreakdown {
  discountSavings: number
  shippingSavings: number
  taxSavings: number
  totalSavings: number
}

const DEFAULT_TIERS: CheckoutTierInfo[] = TIER_HIERARCHY.map((tier) => ({
  name: tier.name,
  slug: tier.slug,
  minAnnualPoints: tier.minAnnualPoints,
  pointMultiplier: tier.pointMultiplier,
}))

function toSafeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback
  }
  return value
}

export function roundMoney(value: number): number {
  return Math.round(toSafeNumber(value, 0) * 100) / 100
}

function resolveTiers(tiers?: CheckoutTierInfo[]): CheckoutTierInfo[] {
  const source = tiers && tiers.length > 0 ? tiers : DEFAULT_TIERS
  const normalized = source
    .map((tier) => ({
      name: tier.name,
      slug: tier.slug,
      minAnnualPoints: Math.max(0, Math.floor(toSafeNumber(tier.minAnnualPoints))),
      pointMultiplier: Math.max(1, toSafeNumber(tier.pointMultiplier, 1)),
    }))
    .sort((a, b) => a.minAnnualPoints - b.minAnnualPoints)

  return normalized.length > 0 ? normalized : DEFAULT_TIERS
}

export function calculateCheckoutLoyaltyPreview(
  input: CheckoutLoyaltyPreviewInput
): CheckoutLoyaltyPreview {
  const baseAmount = Math.max(0, Math.floor(toSafeNumber(input.orderTotal)))
  const currentPoints = Math.max(0, Math.floor(toSafeNumber(input.currentPoints)))
  const annualPointsEarned = Math.max(0, Math.floor(toSafeNumber(input.annualPointsEarned)))

  const tierMultiplier = Math.max(1, toSafeNumber(input.pointMultiplier, 1))
  const eventMultiplier = Math.max(1, toSafeNumber(input.activeEventMultiplier, 1))

  const pointsAfterEvent = Math.floor(baseAmount * eventMultiplier)
  const totalPoints = Math.floor(pointsAfterEvent * tierMultiplier)

  const eventBonusPoints = Math.max(0, pointsAfterEvent - baseAmount)
  const tierBonusPoints = Math.max(0, totalPoints - pointsAfterEvent)

  const projectedCurrentPoints = currentPoints + totalPoints
  const projectedAnnualPoints = annualPointsEarned + totalPoints

  const tiers = resolveTiers(input.tiers)
  const fallbackTier = tiers[0]

  const currentTier =
    tiers.find((tier) => tier.slug === input.currentTierSlug) ??
    [...tiers].reverse().find((tier) => annualPointsEarned >= tier.minAnnualPoints) ??
    fallbackTier

  const projectedTier =
    [...tiers].reverse().find((tier) => projectedAnnualPoints >= tier.minAnnualPoints) ??
    fallbackTier

  const nextTierAfterPurchase =
    tiers.find((tier) => tier.minAnnualPoints > projectedAnnualPoints) ?? null

  const pointsToNextTierAfterPurchase = nextTierAfterPurchase
    ? Math.max(0, nextTierAfterPurchase.minAnnualPoints - projectedAnnualPoints)
    : 0

  return {
    basePoints: baseAmount,
    eventBonusPoints,
    tierBonusPoints,
    totalPoints,
    projectedCurrentPoints,
    projectedAnnualPoints,
    currentTier,
    projectedTier,
    nextTierAfterPurchase,
    pointsToNextTierAfterPurchase,
    willUpgradeTier: currentTier.slug !== projectedTier.slug,
  }
}

export function calculateCheckoutSavings(input: CheckoutSavingsInput): CheckoutSavingsBreakdown {
  const subtotal = Math.max(0, toSafeNumber(input.subtotal))
  const discountSavings = Math.max(0, toSafeNumber(input.discount))
  const shipping = Math.max(0, toSafeNumber(input.shipping))
  const baseShippingPrice = Math.max(0, toSafeNumber(input.baseShippingPrice))
  const tax = Math.max(0, toSafeNumber(input.tax))
  const taxRate = Math.max(0, toSafeNumber(input.taxRate))

  const shippingSavings = Math.max(0, baseShippingPrice - shipping)
  const taxWithoutDiscount = subtotal * taxRate
  const taxSavings = Math.max(0, taxWithoutDiscount - tax)
  const totalSavings = discountSavings + shippingSavings + taxSavings

  return {
    discountSavings: roundMoney(discountSavings),
    shippingSavings: roundMoney(shippingSavings),
    taxSavings: roundMoney(taxSavings),
    totalSavings: roundMoney(totalSavings),
  }
}
