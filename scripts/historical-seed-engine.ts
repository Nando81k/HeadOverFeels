import type { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import {
  DEFAULT_HISTORICAL_SEED,
  HISTORICAL_SEED_PROFILES,
  type HistoricalSeedScale,
  normalizeHistoricalSeedScale,
  resolveHistoricalDateRange,
} from '../lib/seed/historical/config'
import {
  COLOR_PALETTE,
  LOYALTY_TIER_PRESETS,
  POPUP_TEMPLATES,
  PRODUCT_CATEGORIES,
  PRODUCT_COLLECTIONS,
  PRODUCT_NOUNS,
  PROMOTION_CODES,
  REWARD_PRESETS,
  SIZE_SCALE,
} from '../lib/seed/historical/constants'
import {
  allocateWeightedCounts,
  applyGrowthAndSeasonality,
  buildMonthBuckets,
  randomDateFromMonthBucket,
} from '../lib/seed/historical/distribution'
import { clamp, createSeedId, formatCurrency, runInChunks } from '../lib/seed/historical/helpers'
import { createSeedRng, randomDateBetween, sampleWithoutReplacement, type SeedRng } from '../lib/seed/historical/random'
import {
  buildProductPlaceholderImages,
  buildVariantPlaceholderImages,
} from '../lib/commerce/product-placeholders'

const TAX_RATE_MIN = 0.055
const TAX_RATE_MAX = 0.095
const FREE_SHIPPING_THRESHOLD = 90
const DEFAULT_CUSTOMER_PASSWORD = 'SeedPass!123'
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const FIRST_NAMES = [
  'Alex',
  'Jordan',
  'Taylor',
  'Sam',
  'Riley',
  'Avery',
  'Kai',
  'Morgan',
  'Quinn',
  'Parker',
  'Noah',
  'Ari',
  'Jamie',
  'Skyler',
  'Cameron',
]

const LAST_NAMES = [
  'Johnson',
  'Miller',
  'Brown',
  'Garcia',
  'Rodriguez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
]

const CITY_STATE_ZIP = [
  ['New York', 'NY', '10001'],
  ['Los Angeles', 'CA', '90001'],
  ['Austin', 'TX', '78701'],
  ['Seattle', 'WA', '98101'],
  ['Chicago', 'IL', '60601'],
  ['Miami', 'FL', '33101'],
  ['Denver', 'CO', '80201'],
  ['Phoenix', 'AZ', '85001'],
  ['Portland', 'OR', '97201'],
  ['Boston', 'MA', '02108'],
]

const REVIEW_HEADLINES = [
  'Exactly what I was looking for',
  'Great fit and quality',
  'Super comfortable fabric',
  'Solid daily essential',
  'Love the color in person',
  'Runs true to size',
  'Good value for the quality',
  'Fast shipping and easy checkout',
]

const SUPPORT_SUBJECTS = [
  'Order status update',
  'Need exchange assistance',
  'Sizing recommendation',
  'Return label request',
  'Payment verification',
  'Damaged item resolution',
  'Tracking not updating',
  'Gift card issue',
]

const AI_MESSAGE_SAMPLES = {
  user: [
    'Can you help me pick the right size?',
    'I need to update my shipping address.',
    'Is this product available in another color?',
    'How can I redeem points at checkout?',
  ],
  assistant: [
    'Absolutely. I can help with that.',
    'I checked your order and found the latest update.',
    'Here are the available options and next steps.',
    'You can apply points during checkout once signed in.',
  ],
}

const NEWSLETTER_SUBJECT_PREFIX = [
  'Weekly Edit',
  'Drop Alert',
  'Care Points Update',
  'Limited Offer',
  'Top Picks This Week',
]

const PROMOTION_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BOGO'] as const
const RECOMMENDATION_TYPES = [
  'SIMILAR',
  'FREQUENTLY_BOUGHT_TOGETHER',
  'COMPLEMENTARY',
  'ALSO_VIEWED',
  'TRENDING',
  'BEST_SELLERS',
] as const

const NOTIFICATION_TYPES = [
  'POINTS_EARNED',
  'TIER_UPGRADE',
  'ORDER_CONFIRMED',
  'ORDER_SHIPPED',
  'REWARD_AVAILABLE',
  'PROMO_NEW',
  'DROP_REMINDER',
  'GENERAL',
] as const

interface HistoricalSeedRunOptions {
  scale?: HistoricalSeedScale | string | null
  from?: Date | string
  to?: Date | string
  seed?: number
  logger?: Pick<Console, 'log' | 'warn' | 'error'>
}

interface ModelCounts {
  [modelName: string]: number
}

interface HistoricalSeedSummary {
  seed: number
  scale: HistoricalSeedScale
  from: Date
  to: Date
  monthlyOrderDistribution: Array<{ month: string; orders: number }>
  modelCounts: ModelCounts
  tierDistribution: Record<string, number>
  sampleAccounts: Array<{ email: string; role: 'admin' | 'customer'; passwordHint: string }>
}

interface CustomerSeedRow {
  id: string
  email: string
  name: string
  password: string | null
  newsletter: boolean
  smsOptIn: boolean
  birthday: Date | null
  createdAt: Date
}

interface AddressRow {
  id: string
  customerId: string
  firstName: string
  lastName: string
  address1: string
  city: string
  state: string
  postalCode: string
  createdAt: Date
}

interface ProductSeedRow {
  id: string
  name: string
  slug: string
  description: string
  price: number
  compareAtPrice: number | null
  categoryId: string
  images: string
  isLimitedEdition: boolean
  isFeatured: boolean
  isFeaturedNewArrival: boolean
  createdAt: Date
  maxQuantity: number | null
  costPrice: number
}

interface ProductVariantSeedRow {
  id: string
  productId: string
  sku: string
  size: string | null
  color: string | null
  colorHex: string | null
  images: string
  price: number
  inventory: number
  isActive: boolean
  createdAt: Date
  costPrice: number
}

interface ProductOrderCandidate {
  product: ProductSeedRow
  variant: ProductVariantSeedRow
  quantity: number
}

interface CustomerStatsState {
  totalSpent: number
  totalOrders: number
  annualSpend: number
  lastOrderDate: Date | null
  avgOrderValue: number
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
}

interface OrderItemReviewCandidate {
  orderId: string
  productId: string
  customerId: string
  customerName: string
  customerEmail: string
  createdAt: Date
}

interface RuntimeSeedContext {
  rng: SeedRng
  from: Date
  to: Date
  profile: (typeof HISTORICAL_SEED_PROFILES)['large']
  logger: Pick<Console, 'log' | 'warn' | 'error'>
  seed: number
}

function log(ctx: RuntimeSeedContext, message: string): void {
  ctx.logger.log(message)
}

function toTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

function parseDateString(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function ensureNewsletterCampaignDelegate(prisma: PrismaClient): void {
  const hasDelegate = typeof (prisma as unknown as { newsletterCampaign?: { count?: () => Promise<number> } }).newsletterCampaign
    ?.count === 'function'

  if (!hasDelegate) {
    throw new Error('Newsletter campaigns are not ready yet. Run `npx prisma generate` and restart the server.')
  }
}

async function createManyChunked<T>(
  items: readonly T[],
  chunkSize: number,
  insertChunk: (chunkItems: readonly T[]) => Promise<void>
): Promise<void> {
  await runInChunks(items, chunkSize, async (chunkItems) => {
    if (chunkItems.length === 0) {
      return
    }
    await insertChunk(chunkItems)
  })
}

function monthKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function seededSku(productIndex: number, variantIndex: number): string {
  return `HOF-HIST-${String(productIndex + 1).padStart(4, '0')}-${String(variantIndex + 1).padStart(3, '0')}`
}

function variantLabel(variant: ProductVariantSeedRow): string {
  if (variant.size && variant.color) {
    return `${variant.size} / ${variant.color}`
  }
  if (variant.size) return variant.size
  if (variant.color) return variant.color
  return 'Default'
}

function pickOrderStatus(rng: SeedRng, orderDate: Date, to: Date): 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED' {
  const ageDays = (to.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
  if (ageDays < 2) {
    return rng.pick(['PENDING', 'CONFIRMED', 'PROCESSING'] as const)
  }
  if (ageDays < 7) {
    return rng.pick(['PROCESSING', 'SHIPPED', 'CONFIRMED'] as const)
  }
  if (ageDays < 21) {
    return rng.pick(['SHIPPED', 'DELIVERED', 'PROCESSING', 'CANCELLED'] as const)
  }
  return rng.pick(['DELIVERED', 'DELIVERED', 'DELIVERED', 'SHIPPED', 'REFUNDED', 'CANCELLED'] as const)
}

function derivePaymentStatus(orderStatus: string, rng: SeedRng): 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' {
  if (orderStatus === 'CANCELLED') {
    return rng.bool(0.45) ? 'FAILED' : 'REFUNDED'
  }
  if (orderStatus === 'REFUNDED') {
    return 'REFUNDED'
  }
  if (orderStatus === 'PENDING') {
    return rng.bool(0.75) ? 'PENDING' : 'FAILED'
  }
  return 'PAID'
}

function buildTracking(orderStatus: string, orderDate: Date, rng: SeedRng): { trackingNumber: string | null; carrier: string | null; shippedAt: Date | null; deliveredAt: Date | null; estimatedDelivery: Date | null } {
  if (!['SHIPPED', 'DELIVERED', 'REFUNDED'].includes(orderStatus)) {
    return {
      trackingNumber: null,
      carrier: null,
      shippedAt: null,
      deliveredAt: null,
      estimatedDelivery: null,
    }
  }

  const shippedAt = new Date(orderDate.getTime() + rng.int(1, 3) * 24 * 60 * 60 * 1000)
  const estimatedDelivery = new Date(shippedAt.getTime() + rng.int(2, 6) * 24 * 60 * 60 * 1000)
  const deliveredAt = orderStatus === 'DELIVERED' || orderStatus === 'REFUNDED'
    ? new Date(estimatedDelivery.getTime() + rng.int(0, 2) * 24 * 60 * 60 * 1000)
    : null

  return {
    trackingNumber: `9${rng.int(1000000000000000000000, 9999999999999999999999)}`,
    carrier: rng.pick(['USPS', 'UPS', 'FedEx']),
    shippedAt,
    deliveredAt,
    estimatedDelivery,
  }
}

function tierFromAnnualSpend(annualSpend: number): string {
  if (annualSpend >= 4200) return 'tier-bestie'
  if (annualSpend >= 1800) return 'tier-heart'
  if (annualSpend >= 600) return 'tier-friend'
  return 'tier-newcomer'
}

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function pickCustomerName(rng: SeedRng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`
}

function pickAddress(rng: SeedRng): { city: string; state: string; postalCode: string } {
  const [city, state, postalCode] = rng.pick(CITY_STATE_ZIP)
  return { city, state, postalCode }
}

function productImageUrls(
  productName: string,
  slug: string,
  options?: { color?: string | null; colorHex?: string | null; size?: string | null }
): string[] {
  if (options?.color || options?.colorHex || options?.size) {
    return buildVariantPlaceholderImages({
      productName,
      productSlug: slug,
      color: options.color,
      colorHex: options.colorHex,
      size: options.size,
    })
  }

  return buildProductPlaceholderImages({
    productName,
    productSlug: slug,
  })
}

async function seedFoundation(
  prisma: PrismaClient,
  ctx: RuntimeSeedContext,
  adminUserIds: string[]
): Promise<{
  categoryIds: string[]
  collectionIds: string[]
  promotionIds: string[]
  expenseCategoryIds: string[]
  tierIds: string[]
  rewardIds: string[]
}> {
  log(ctx, '\n📦 Seeding foundation models...')

  await prisma.loyaltySettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      isEnabled: true,
      programName: 'Care Points',
      pointsPerDollar: 10,
      pointsRoundingMode: 'round',
      minimumOrderForPoints: 0,
      referralPointsReferrer: 350,
      referralPointsReferred: 200,
      referralEnabled: true,
      reviewPointsEnabled: true,
      reviewPointsAmount: 40,
      reviewWithPhotoBonus: 15,
      birthdayRewardsEnabled: true,
      birthdayRewardType: 'points',
      birthdayRewardValue: 200,
      birthdayRewardExpireDays: 30,
      pointsExpireEnabled: true,
      pointsExpireMonths: 12,
      tierEvaluationPeriod: 'annual',
      tierDowngradeEnabled: true,
      showPointsInCart: true,
      showPointsInCheckout: true,
      showTierProgress: true,
    },
    update: {
      isEnabled: true,
      programName: 'Care Points',
      pointsPerDollar: 10,
      pointsRoundingMode: 'round',
      minimumOrderForPoints: 0,
      referralPointsReferrer: 350,
      referralPointsReferred: 200,
      referralEnabled: true,
      reviewPointsEnabled: true,
      reviewPointsAmount: 40,
      reviewWithPhotoBonus: 15,
      birthdayRewardsEnabled: true,
      birthdayRewardType: 'points',
      birthdayRewardValue: 200,
      birthdayRewardExpireDays: 30,
      pointsExpireEnabled: true,
      pointsExpireMonths: 12,
      tierEvaluationPeriod: 'annual',
      tierDowngradeEnabled: true,
      showPointsInCart: true,
      showPointsInCheckout: true,
      showTierProgress: true,
    },
  })

  for (const tier of LOYALTY_TIER_PRESETS) {
    await prisma.loyaltyTier.upsert({
      where: { id: tier.id },
      create: {
        ...tier,
        isActive: true,
      },
      update: {
        ...tier,
        isActive: true,
      },
    })
  }

  for (const reward of REWARD_PRESETS) {
    await prisma.reward.upsert({
      where: { id: reward.id },
      create: {
        ...reward,
        isActive: true,
      },
      update: {
        ...reward,
        isActive: true,
      },
    })
  }

  await prisma.salesGoals.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      dailyTarget: 6500,
      weeklyTarget: 42000,
      monthlyTarget: 180000,
      quarterlyTarget: 540000,
      yearlyTarget: 2160000,
    },
    update: {
      dailyTarget: 6500,
      weeklyTarget: 42000,
      monthlyTarget: 180000,
      quarterlyTarget: 540000,
      yearlyTarget: 2160000,
    },
  })

  if (adminUserIds.length > 0) {
    await prisma.adminAvailability.createMany({
      data: adminUserIds.map((adminId) => ({
        id: `hist-admin-availability-${adminId}`,
        adminId,
        isOnline: false,
        status: 'offline',
        maxChats: 5,
        activeChats: 0,
      })),
      skipDuplicates: true,
    })
  }

  const categoryRows = PRODUCT_CATEGORIES.map((category, index) => ({
    id: `hist-category-${category.slug}`,
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: `https://cdn.headoverfeels.com/categories/${category.slug}.jpg`,
    isActive: true,
    sortOrder: index,
    createdAt: ctx.from,
    updatedAt: ctx.from,
  }))
  await prisma.category.createMany({ data: categoryRows, skipDuplicates: true })

  const collectionRows = PRODUCT_COLLECTIONS.map((collection, index) => ({
    id: `hist-collection-${collection.slug}`,
    name: collection.name,
    slug: collection.slug,
    description: collection.description,
    image: `https://cdn.headoverfeels.com/collections/${collection.slug}.jpg`,
    isActive: true,
    isFeatured: collection.isFeatured,
    sortOrder: index,
    createdAt: ctx.from,
    updatedAt: ctx.from,
  }))
  await prisma.collection.createMany({ data: collectionRows, skipDuplicates: true })

  const expenseCategories = [
    ['inventory', 'Inventory & COGS', '#4F46E5'],
    ['shipping', 'Shipping & Fulfillment', '#0284C7'],
    ['marketing', 'Marketing', '#E11D48'],
    ['payroll', 'Payroll', '#8B5CF6'],
    ['software', 'Software', '#10B981'],
    ['facilities', 'Facilities', '#A16207'],
    ['fees', 'Processing Fees', '#DC2626'],
    ['other', 'Other', '#6B7280'],
  ] as const

  await prisma.expenseCategory.createMany({
    data: expenseCategories.map(([slug, name, color], index) => ({
      id: `hist-expense-category-${slug}`,
      slug,
      name,
      color,
      icon: 'ChartBar',
      isActive: true,
      sortOrder: index,
      createdAt: ctx.from,
      updatedAt: ctx.from,
    })),
    skipDuplicates: true,
  })

  await prisma.budget.createMany({
    data: [
      {
        id: 'hist-budget-marketing',
        categoryId: 'hist-expense-category-marketing',
        name: 'Marketing Monthly Budget',
        amount: 45000,
        period: 'MONTHLY',
        startDate: ctx.from,
        endDate: ctx.to,
        warningThreshold: 75,
        criticalThreshold: 90,
        isActive: true,
      },
      {
        id: 'hist-budget-shipping',
        categoryId: 'hist-expense-category-shipping',
        name: 'Shipping Monthly Budget',
        amount: 32000,
        period: 'MONTHLY',
        startDate: ctx.from,
        endDate: ctx.to,
        warningThreshold: 75,
        criticalThreshold: 90,
        isActive: true,
      },
      {
        id: 'hist-budget-software',
        categoryId: 'hist-expense-category-software',
        name: 'Software Monthly Budget',
        amount: 9000,
        period: 'MONTHLY',
        startDate: ctx.from,
        endDate: ctx.to,
        warningThreshold: 75,
        criticalThreshold: 90,
        isActive: true,
      },
    ],
    skipDuplicates: true,
  })

  const promotionRows: Array<Record<string, unknown>> = []
  for (let index = 0; index < ctx.profile.promotions; index += 1) {
    const type = ctx.rng.pick(PROMOTION_TYPES)
    const code = index < PROMOTION_CODES.length ? PROMOTION_CODES[index] : `HIST${String(index + 1).padStart(3, '0')}`
    const startDate = randomDateBetween(ctx.rng, ctx.from, new Date(ctx.to.getTime() - 14 * 24 * 60 * 60 * 1000))
    const durationDays = ctx.rng.int(7, 45)
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000)
    const value = type === 'FREE_SHIPPING' ? 0 : type === 'FIXED_AMOUNT' ? ctx.rng.int(5, 35) : ctx.rng.int(10, 35)
    promotionRows.push({
      id: createSeedId('hist-promotion', index + 1),
      name: `${code} Campaign`,
      description: `${code} seasonal promotion`,
      type,
      value,
      code: ctx.rng.bool(0.82) ? code : null,
      autoApply: ctx.rng.bool(0.24),
      minimumPurchase: ctx.rng.bool(0.65) ? ctx.rng.int(35, 140) : null,
      maxUsesTotal: ctx.rng.bool(0.5) ? ctx.rng.int(400, 3200) : null,
      maxUsesPerCustomer: ctx.rng.bool(0.65) ? ctx.rng.int(1, 3) : null,
      usedCount: 0,
      startDate,
      endDate,
      isActive: endDate > ctx.to ? true : ctx.rng.bool(0.3),
      stackable: ctx.rng.bool(0.22),
      maxDiscountPercent: type === 'PERCENTAGE' ? ctx.rng.int(25, 60) : null,
      excludeFromLoyalty: ctx.rng.bool(0.12),
      totalDiscountGiven: 0,
      createdAt: startDate,
      updatedAt: startDate,
    })
  }
  await prisma.promotion.createMany({ data: promotionRows as never[], skipDuplicates: true })

  const popupRows: Array<Record<string, unknown>> = []
  for (let index = 0; index < ctx.profile.marketingPopups; index += 1) {
    const popupStartDate = randomDateBetween(ctx.rng, ctx.from, ctx.to)
    const promotion = promotionRows.length > 0 ? promotionRows[index % promotionRows.length] : null
    popupRows.push({
      id: createSeedId('hist-popup', index + 1),
      name: `Popup ${index + 1}`,
      template: ctx.rng.pick(POPUP_TEMPLATES),
      position: ctx.rng.pick(['TOP', 'BOTTOM', 'CENTER', 'BOTTOM_RIGHT', 'TOP_RIGHT']),
      content: JSON.stringify({
        headline: 'Stay in the loop',
        body: 'Get updates on drops, rewards, and seasonal offers.',
        ctaLabel: 'Join Newsletter',
      }),
      triggerType: ctx.rng.pick(['DELAY', 'SCROLL', 'EXIT_INTENT', 'IMMEDIATE']),
      triggerValue: ctx.rng.int(2, 12),
      showOnPages: ctx.rng.pick(['all', '/products', '/collections', '/cart']),
      showToNewVisitors: true,
      showToReturning: true,
      frequency: ctx.rng.pick(['ONCE_PER_SESSION', 'ONCE_PER_DAY', 'ONCE_EVER']),
      startDate: popupStartDate,
      endDate: new Date(popupStartDate.getTime() + ctx.rng.int(30, 220) * 24 * 60 * 60 * 1000),
      isActive: ctx.rng.bool(0.55),
      priority: ctx.rng.int(0, 10),
      promotionId: promotion ? (promotion.id as string) : null,
      createdAt: popupStartDate,
      updatedAt: popupStartDate,
    })
  }
  await prisma.marketingPopup.createMany({ data: popupRows as never[], skipDuplicates: true })

  const popupVariantRows: Array<Record<string, unknown>> = []
  for (let index = 0; index < ctx.profile.popupVariants; index += 1) {
    const popup = popupRows[index % popupRows.length]
    popupVariantRows.push({
      id: createSeedId('hist-popup-variant', index + 1),
      popupId: popup.id as string,
      name: `Variant ${index + 1}`,
      content: JSON.stringify({
        headline: `Variant ${index + 1}`,
        body: 'Tested messaging variation.',
      }),
      weight: ctx.rng.int(15, 80),
      isActive: true,
      createdAt: popup.createdAt as Date,
      updatedAt: popup.createdAt as Date,
    })
  }
  await prisma.popupVariant.createMany({ data: popupVariantRows as never[], skipDuplicates: true })

  const popupAnalyticsRows: Array<Record<string, unknown>> = []
  for (let index = 0; index < ctx.profile.popupAnalytics; index += 1) {
    const variant = popupVariantRows[index % popupVariantRows.length]
    const popup = popupRows.find((row) => row.id === variant.popupId) ?? popupRows[0]
    const date = randomDateBetween(ctx.rng, ctx.from, ctx.to)
    popupAnalyticsRows.push({
      id: createSeedId('hist-popup-analytics', index + 1),
      popupId: popup.id as string,
      variantId: variant.id as string,
      date: new Date(date.getTime() + index),
      impressions: ctx.rng.int(120, 6400),
      clicks: ctx.rng.int(15, 900),
      dismissals: ctx.rng.int(20, 1500),
      conversions: ctx.rng.int(2, 280),
    })
  }
  await createManyChunked(popupAnalyticsRows, 1000, async (chunkRows) => {
    await prisma.popupAnalytics.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  log(ctx, `   ✅ Promotions: ${promotionRows.length}`)
  log(ctx, `   ✅ Popups: ${popupRows.length} (${popupVariantRows.length} variants, ${popupAnalyticsRows.length} analytics rows)`)

  return {
    categoryIds: categoryRows.map((row) => row.id),
    collectionIds: collectionRows.map((row) => row.id),
    promotionIds: promotionRows.map((row) => row.id as string),
    expenseCategoryIds: expenseCategories.map(([slug]) => `hist-expense-category-${slug}`),
    tierIds: LOYALTY_TIER_PRESETS.map((tier) => tier.id),
    rewardIds: REWARD_PRESETS.map((reward) => reward.id),
  }
}

function generateProductsAndVariants(
  ctx: RuntimeSeedContext,
  categoryIds: string[]
): { products: ProductSeedRow[]; variants: ProductVariantSeedRow[] } {
  const products: ProductSeedRow[] = []
  const variants: ProductVariantSeedRow[] = []

  const productCount = ctx.profile.products
  const targetVariants = ctx.profile.variants
  const variantDistribution = new Array(productCount).fill(1)
  let remaining = targetVariants - productCount

  while (remaining > 0) {
    const index = ctx.rng.int(0, productCount - 1)
    if (variantDistribution[index] >= 12) {
      continue
    }
    variantDistribution[index] += 1
    remaining -= 1
  }

  for (let index = 0; index < productCount; index += 1) {
    const productId = createSeedId('hist-product', index + 1)
    const noun = PRODUCT_NOUNS[index % PRODUCT_NOUNS.length]
    const moodPrefix = ctx.rng.pick(['Calm', 'Quiet', 'Open', 'Soft', 'Daily', 'Anchor', 'Restore', 'Flow'])
    const productName = `${moodPrefix} ${noun} ${index + 1}`
    const slug = sanitizeSlug(productName)
    const price = toTwoDecimals(ctx.rng.int(28, 168) + ctx.rng.float(0, 0.99))
    const compareAtPrice = ctx.rng.bool(0.42) ? toTwoDecimals(price * (1 + ctx.rng.float(0.1, 0.35))) : null
    const isLimitedEdition = ctx.rng.bool(0.09)
    const createdAt = randomDateBetween(ctx.rng, ctx.from, ctx.to)
    const categoryId = categoryIds[index % categoryIds.length]
    const maxQuantity = ctx.rng.bool(0.24) ? ctx.rng.int(2, 8) : null
    const costPrice = toTwoDecimals(price * ctx.rng.float(0.28, 0.58))

    products.push({
      id: productId,
      name: productName,
      slug,
      description: `Premium ${noun.toLowerCase()} built for comfort, movement, and repeat wear.`,
      price,
      compareAtPrice,
      categoryId,
      images: JSON.stringify(productImageUrls(productName, slug)),
      isLimitedEdition,
      isFeatured: ctx.rng.bool(0.2),
      isFeaturedNewArrival: ctx.rng.bool(0.16),
      createdAt,
      maxQuantity,
      costPrice,
    })

    const variantsForProduct = variantDistribution[index]
    const mode = ctx.rng.pick(['both', 'both', 'both', 'color', 'size', 'single'] as const)
    const colorPool = sampleWithoutReplacement(ctx.rng, COLOR_PALETTE, ctx.rng.int(2, 5))
    const sizePool = sampleWithoutReplacement(ctx.rng, SIZE_SCALE, ctx.rng.int(3, SIZE_SCALE.length))
    const usedKeys = new Set<string>()

    for (let variantIndex = 0; variantIndex < variantsForProduct; variantIndex += 1) {
      let size: string | null = null
      let color: string | null = null
      let colorHex: string | null = null

      if (mode === 'single') {
        size = null
        color = null
      } else if (mode === 'color') {
        const selectedColor = colorPool[variantIndex % colorPool.length]
        color = selectedColor.name
        colorHex = selectedColor.hex
      } else if (mode === 'size') {
        size = sizePool[variantIndex % sizePool.length]
      } else {
        const selectedColor = colorPool[variantIndex % colorPool.length]
        const selectedSize = sizePool[Math.floor(variantIndex / Math.max(1, colorPool.length)) % sizePool.length]
        color = selectedColor.name
        colorHex = selectedColor.hex
        size = selectedSize
      }

      const key = `${size ?? 'na'}-${color ?? 'na'}`
      if (usedKeys.has(key)) {
        continue
      }
      usedKeys.add(key)

      const variantPrice = toTwoDecimals(
        clamp((products[index].compareAtPrice ?? products[index].price) * ctx.rng.float(0.82, 1.12), 18, 240)
      )
      const inventory = ctx.rng.bool(0.08) ? 0 : ctx.rng.int(1, 180)
      const variantCostPrice = toTwoDecimals(variantPrice * ctx.rng.float(0.25, 0.6))
      const variantId = createSeedId('hist-variant', variants.length + 1)

      variants.push({
        id: variantId,
        productId,
        sku: seededSku(index, variantIndex),
        size,
        color,
        colorHex,
        images: JSON.stringify(
          productImageUrls(productName, slug, {
            color,
            colorHex,
            size,
          })
        ),
        price: variantPrice,
        inventory,
        isActive: ctx.rng.bool(0.97),
        createdAt,
        costPrice: variantCostPrice,
      })
    }
  }

  // Guarantee exact variant volume target even when mode/key dedupe reduces combinations.
  while (variants.length < targetVariants) {
    const productIndex = ctx.rng.int(0, products.length - 1)
    const product = products[productIndex]
    const fallbackColor = COLOR_PALETTE[(variants.length + productIndex) % COLOR_PALETTE.length]
    const fallbackSize = SIZE_SCALE[(variants.length + productIndex) % SIZE_SCALE.length]
    const variantId = createSeedId('hist-variant', variants.length + 1)
    const fallbackPrice = toTwoDecimals(clamp(product.price * ctx.rng.float(0.9, 1.15), 18, 240))

    variants.push({
      id: variantId,
      productId: product.id,
      sku: `HOF-HIST-FILL-${String(variants.length + 1).padStart(6, '0')}`,
      size: fallbackSize,
      color: `${fallbackColor.name} ${Math.floor((variants.length + 1) / COLOR_PALETTE.length)}`,
      colorHex: fallbackColor.hex,
      images: JSON.stringify(
        productImageUrls(product.name, product.slug, {
          color: `${fallbackColor.name} ${Math.floor((variants.length + 1) / COLOR_PALETTE.length)}`,
          colorHex: fallbackColor.hex,
          size: fallbackSize,
        })
      ),
      price: fallbackPrice,
      inventory: ctx.rng.int(0, 120),
      isActive: true,
      createdAt: randomDateBetween(ctx.rng, product.createdAt, ctx.to),
      costPrice: toTwoDecimals(fallbackPrice * ctx.rng.float(0.28, 0.58)),
    })
  }

  return { products, variants }
}

async function seedCatalog(
  prisma: PrismaClient,
  ctx: RuntimeSeedContext,
  categoryIds: string[],
  collectionIds: string[]
): Promise<{ products: ProductSeedRow[]; variants: ProductVariantSeedRow[] }> {
  log(ctx, '\n🛍️  Seeding products, variants, collections, recommendations...')
  const { products, variants } = generateProductsAndVariants(ctx, categoryIds)

  await createManyChunked(products, 500, async (chunkRows) => {
    await prisma.product.createMany({
      data: chunkRows.map((row) => ({
        ...row,
        isActive: true,
        updatedAt: row.createdAt,
        materials: 'Cotton blend',
        careGuide: 'Machine wash cold, tumble dry low',
      })),
      skipDuplicates: true,
    })
  })

  await createManyChunked(variants, 1000, async (chunkRows) => {
    await prisma.productVariant.createMany({
      data: chunkRows.map((row) => ({
        ...row,
        updatedAt: row.createdAt,
      })),
      skipDuplicates: true,
    })
  })

  const collectionProductRows: Array<Record<string, unknown>> = []
  for (const product of products) {
    const collectionCount = ctx.rng.int(1, 3)
    const selectedCollections = sampleWithoutReplacement(ctx.rng, collectionIds, collectionCount)
    selectedCollections.forEach((collectionId, index) => {
      collectionProductRows.push({
        id: createSeedId('hist-collection-product', collectionProductRows.length + 1),
        collectionId,
        productId: product.id,
        sortOrder: index,
        createdAt: product.createdAt,
      })
    })
  }
  await createManyChunked(collectionProductRows, 1000, async (chunkRows) => {
    await prisma.collectionProduct.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  const recommendationRows: Array<Record<string, unknown>> = []
  const recommendationKeys = new Set<string>()
  while (recommendationRows.length < ctx.profile.productRecommendations) {
    const source = ctx.rng.pick(products)
    const target = ctx.rng.pick(products)
    if (source.id === target.id) {
      continue
    }

    const type = ctx.rng.pick(RECOMMENDATION_TYPES)
    const key = `${source.id}:${target.id}:${type}`
    if (recommendationKeys.has(key)) {
      continue
    }
    recommendationKeys.add(key)

    recommendationRows.push({
      id: createSeedId('hist-recommendation', recommendationRows.length + 1),
      sourceProductId: source.id,
      targetProductId: target.id,
      type,
      score: toTwoDecimals(ctx.rng.float(0.2, 0.99)),
      impressions: ctx.rng.int(100, 9500),
      clicks: ctx.rng.int(20, 1200),
      conversions: ctx.rng.int(0, 220),
      revenue: toTwoDecimals(ctx.rng.float(0, 18000)),
      reason: 'Historical recommendation seed',
      createdAt: randomDateBetween(ctx.rng, ctx.from, ctx.to),
      updatedAt: ctx.to,
    })
  }
  await createManyChunked(recommendationRows, 1000, async (chunkRows) => {
    await prisma.productRecommendation.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  const limitedProducts = products.filter((product) => product.isLimitedEdition).slice(0, 24)
  const dropEarlyAccessRows: Array<Record<string, unknown>> = []
  for (const product of limitedProducts) {
    for (const tier of LOYALTY_TIER_PRESETS.filter((item) => item.sortOrder > 0)) {
      const startDate = new Date(product.createdAt.getTime() - (tier.sortOrder + 1) * 24 * 60 * 60 * 1000)
      const endDate = product.createdAt
      dropEarlyAccessRows.push({
        id: createSeedId('hist-drop-early-access', dropEarlyAccessRows.length + 1),
        productId: product.id,
        loyaltyTierId: tier.id,
        startDate,
        endDate,
        pointsCost: 700 + tier.sortOrder * 200,
        isActive: true,
        createdAt: startDate,
        updatedAt: startDate,
      })
    }
  }
  await createManyChunked(dropEarlyAccessRows, 500, async (chunkRows) => {
    await prisma.dropEarlyAccess.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  log(ctx, `   ✅ Products: ${products.length}`)
  log(ctx, `   ✅ Variants: ${variants.length}`)
  log(ctx, `   ✅ Collection links: ${collectionProductRows.length}`)
  log(ctx, `   ✅ Product recommendations: ${recommendationRows.length}`)

  return { products, variants }
}

async function seedCustomers(
  prisma: PrismaClient,
  ctx: RuntimeSeedContext,
  adminUserIds: string[]
): Promise<{
  customers: CustomerSeedRow[]
  addresses: AddressRow[]
  adminCustomerIds: string[]
}> {
  log(ctx, '\n👥 Seeding customers, profiles, and account entities...')

  const adminCustomers = await prisma.customer.findMany({
    where: { isAdmin: true },
    select: { id: true, email: true, password: true, name: true },
  })

  if (adminCustomers.length === 0 && adminUserIds.length > 0) {
    const fallbackAdmin = await prisma.adminUser.findFirst({
      where: { id: adminUserIds[0] },
      select: { id: true, email: true, password: true, name: true },
    })

    if (fallbackAdmin) {
      await prisma.customer.create({
        data: {
          id: `hist-admin-customer-${fallbackAdmin.id}`,
          email: fallbackAdmin.email.toLowerCase(),
          password: fallbackAdmin.password,
          name: fallbackAdmin.name,
          isAdmin: true,
          newsletter: false,
          smsOptIn: false,
          loyaltyTierId: 'tier-newcomer',
        },
      })
    }
  }

  const refreshedAdminCustomers = await prisma.customer.findMany({
    where: { isAdmin: true },
    select: { id: true },
  })
  const adminCustomerIds = refreshedAdminCustomers.map((row) => row.id)

  if (adminCustomerIds.length === 0) {
    throw new Error('At least one admin customer is required for seeded campaign ownership.')
  }

  const customerPasswordHash = await bcrypt.hash(DEFAULT_CUSTOMER_PASSWORD, 10)
  const customerRows: CustomerSeedRow[] = []
  const addressRows: AddressRow[] = []
  const notificationPreferenceRows: Array<Record<string, unknown>> = []
  const referralRows: Array<Record<string, unknown>> = []
  const customerNoteRows: Array<Record<string, unknown>> = []
  const accountRows: Array<Record<string, unknown>> = []
  const sessionRows: Array<Record<string, unknown>> = []
  const verificationRows: Array<Record<string, unknown>> = []

  const monthBuckets = applyGrowthAndSeasonality(buildMonthBuckets(ctx.from, ctx.to))
  const customerDistribution = allocateWeightedCounts(ctx.profile.nonAdminCustomers, monthBuckets.map((bucket) => bucket.weight))

  let customerIndex = 0
  for (let monthIndex = 0; monthIndex < monthBuckets.length; monthIndex += 1) {
    const bucket = monthBuckets[monthIndex]
    const monthCount = customerDistribution[monthIndex]
    for (let i = 0; i < monthCount; i += 1) {
      customerIndex += 1
      const id = createSeedId('hist-customer', customerIndex)
      const name = pickCustomerName(ctx.rng)
      const [firstName, ...rest] = name.split(' ')
      const lastName = rest.join(' ') || 'Customer'
      const email = `customer${String(customerIndex).padStart(5, '0')}@seed.headoverfeels.test`
      const createdAt = randomDateFromMonthBucket(ctx.rng, bucket)
      const newsletter = ctx.rng.bool(0.58)
      const smsOptIn = ctx.rng.bool(0.34)
      const birthday = ctx.rng.bool(0.72)
        ? new Date(Date.UTC(ctx.rng.int(1980, 2006), ctx.rng.int(0, 11), ctx.rng.int(1, 28), 0, 0, 0, 0))
        : null

      customerRows.push({
        id,
        email,
        name,
        password: ctx.rng.bool(0.34) ? customerPasswordHash : null,
        newsletter,
        smsOptIn,
        birthday,
        createdAt,
      })

      const { city, state, postalCode } = pickAddress(ctx.rng)
      addressRows.push({
        id: createSeedId('hist-address', customerIndex),
        customerId: id,
        firstName,
        lastName,
        address1: `${ctx.rng.int(100, 9999)} ${ctx.rng.pick(['Main', 'Oak', 'Pine', 'Cedar', 'Maple'])} St`,
        city,
        state,
        postalCode,
        createdAt,
      })

      notificationPreferenceRows.push({
        id: createSeedId('hist-notification-preference', customerIndex),
        customerId: id,
        inAppPointsEarned: true,
        inAppTierUpdates: true,
        inAppOrderUpdates: true,
        inAppPromotions: true,
        inAppDropAlerts: true,
        inAppRewardReminders: true,
        emailPointsEarned: ctx.rng.bool(0.45),
        emailTierUpdates: true,
        emailOrderUpdates: true,
        emailPromotions: ctx.rng.bool(0.64),
        emailDropAlerts: ctx.rng.bool(0.5),
        emailRewardReminders: true,
        emailPointsExpiring: true,
        emailBirthdayBonus: true,
        smsOrderUpdates: smsOptIn,
        smsDropAlerts: ctx.rng.bool(0.2) && smsOptIn,
        createdAt,
        updatedAt: createdAt,
      })

      if (ctx.rng.bool(0.52)) {
        referralRows.push({
          id: createSeedId('hist-referral', referralRows.length + 1),
          customerId: id,
          code: `CARE${String(customerIndex).padStart(6, '0')}`,
          timesUsed: ctx.rng.int(0, 12),
          createdAt,
        })
      }

      if (ctx.rng.bool(0.18)) {
        customerNoteRows.push({
          id: createSeedId('hist-customer-note', customerNoteRows.length + 1),
          customerId: id,
          content: ctx.rng.pick([
            'Prefers neutral color palettes and oversized fit.',
            'Frequent repeat buyer with low return rate.',
            'Asked for early access notifications.',
            'Responds well to loyalty offers.',
          ]),
          authorId: adminUserIds[0] ?? 'system',
          authorName: 'Admin Team',
          isImportant: ctx.rng.bool(0.12),
          createdAt,
          updatedAt: createdAt,
        })
      }

      if (ctx.rng.bool(0.16)) {
        accountRows.push({
          id: createSeedId('hist-account', accountRows.length + 1),
          userId: id,
          type: 'oauth',
          provider: 'google',
          providerAccountId: `google-${id}`,
        })
      }

      if (ctx.rng.bool(0.24)) {
        const sessionCreatedAt = randomDateBetween(ctx.rng, createdAt, ctx.to)
        sessionRows.push({
          id: createSeedId('hist-session', sessionRows.length + 1),
          sessionToken: `sess_${id}_${sessionRows.length + 1}`,
          userId: id,
          expires: new Date(sessionCreatedAt.getTime() + ctx.rng.int(2, 30) * 24 * 60 * 60 * 1000),
        })
      }

      if (ctx.rng.bool(0.1)) {
        verificationRows.push({
          identifier: email,
          token: `verify_${id}_${verificationRows.length + 1}`,
          expires: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
        })
      }
    }
  }

  await createManyChunked(customerRows, 1000, async (chunkRows) => {
    await prisma.customer.createMany({
      data: chunkRows.map((row) => ({
        id: row.id,
        email: row.email,
        password: row.password,
        name: row.name,
        phone: `+1-555-${ctx.rng.int(100, 999)}-${ctx.rng.int(1000, 9999)}`,
        isAdmin: false,
        birthday: row.birthday,
        newsletter: row.newsletter,
        smsOptIn: row.smsOptIn,
        loyaltyTierId: 'tier-newcomer',
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
      })),
      skipDuplicates: true,
    })
  })

  await createManyChunked(addressRows, 1000, async (chunkRows) => {
    await prisma.address.createMany({
      data: chunkRows.map((row) => ({
        id: row.id,
        customerId: row.customerId,
        firstName: row.firstName,
        lastName: row.lastName,
        address1: row.address1,
        city: row.city,
        state: row.state,
        postalCode: row.postalCode,
        country: 'US',
        isDefault: true,
        type: 'BOTH',
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
      })),
      skipDuplicates: true,
    })
  })

  await createManyChunked(notificationPreferenceRows, 1000, async (chunkRows) => {
    await prisma.notificationPreference.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(referralRows, 1000, async (chunkRows) => {
    await prisma.referralCode.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(customerNoteRows, 1000, async (chunkRows) => {
    await prisma.customerNote.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(accountRows, 1000, async (chunkRows) => {
    await prisma.account.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(sessionRows, 1000, async (chunkRows) => {
    await prisma.session.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(verificationRows, 1000, async (chunkRows) => {
    await prisma.verificationToken.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  log(ctx, `   ✅ Customers: ${customerRows.length} non-admin`)
  log(ctx, `   ✅ Addresses: ${addressRows.length}`)
  log(ctx, `   ✅ Notification preferences: ${notificationPreferenceRows.length}`)
  log(ctx, `   ✅ Referral codes: ${referralRows.length}`)
  log(ctx, `   ✅ Auth accounts/sessions: ${accountRows.length}/${sessionRows.length}`)

  return {
    customers: customerRows,
    addresses: addressRows,
    adminCustomerIds,
  }
}

async function seedAvatarData(
  prisma: PrismaClient,
  ctx: RuntimeSeedContext,
  customers: CustomerSeedRow[],
  products: ProductSeedRow[]
): Promise<void> {
  const avatarItemRows: Array<Record<string, unknown>> = []
  const slots = ['HAIR', 'TOP', 'BOTTOM', 'SHOES', 'ACCESSORY', 'HEADWEAR', 'OUTERWEAR'] as const
  const rarities = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const

  for (let index = 0; index < 64; index += 1) {
    const slot = slots[index % slots.length]
    const linkedProduct = products[index % products.length]
    avatarItemRows.push({
      id: createSeedId('hist-avatar-item', index + 1),
      name: `${slot.toLowerCase()} item ${index + 1}`,
      description: `Avatar ${slot.toLowerCase()} customization item.`,
      slot,
      modelUrl: `https://cdn.headoverfeels.com/avatar/${slot.toLowerCase()}-${index + 1}.glb`,
      thumbnailUrl: `https://cdn.headoverfeels.com/avatar/${slot.toLowerCase()}-${index + 1}.png`,
      productId: ctx.rng.bool(0.72) ? linkedProduct.id : null,
      rarity: rarities[Math.min(rarities.length - 1, Math.floor(index / 16))],
      isDefault: index < 7,
      createdAt: randomDateBetween(ctx.rng, ctx.from, ctx.to),
      updatedAt: ctx.to,
    })
  }

  await prisma.avatarItem.createMany({ data: avatarItemRows as never[], skipDuplicates: true })

  const userAvatarRows: Array<Record<string, unknown>> = []
  const userAvatarItemRows: Array<Record<string, unknown>> = []
  const selectedCustomers = customers.filter(() => ctx.rng.bool(0.48))
  for (const customer of selectedCustomers) {
    userAvatarRows.push({
      id: createSeedId('hist-user-avatar', userAvatarRows.length + 1),
      customerId: customer.id,
      configuration: JSON.stringify({
        equipped: {},
      }),
      skinTone: ctx.rng.pick(['#FFE0BD', '#FFCD94', '#EAC086', '#FFAD60', '#FFE39F', '#8D5524']),
      bodyType: ctx.rng.pick(['default', 'athletic', 'relaxed']),
      gender: ctx.rng.pick(['male', 'female', 'neutral']),
      faceFeatures: JSON.stringify({
        eyeShape: ctx.rng.pick(['round', 'almond', 'narrow']),
        noseShape: ctx.rng.pick(['small', 'medium', 'wide']),
        mouthShape: ctx.rng.pick(['smile', 'neutral']),
      }),
      createdAt: customer.createdAt,
      updatedAt: ctx.to,
    })

    const unlockedCount = ctx.rng.int(3, 16)
    const unlockedItems = sampleWithoutReplacement(ctx.rng, avatarItemRows, unlockedCount)
    for (const item of unlockedItems) {
      userAvatarItemRows.push({
        id: createSeedId('hist-user-avatar-item', userAvatarItemRows.length + 1),
        customerId: customer.id,
        avatarItemId: item.id as string,
        unlockedVia: ctx.rng.pick(['purchase', 'reward', 'drop']),
        orderId: null,
        unlockedAt: randomDateBetween(ctx.rng, customer.createdAt, ctx.to),
      })
    }
  }

  await createManyChunked(userAvatarRows, 1000, async (chunkRows) => {
    await prisma.userAvatar.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(userAvatarItemRows, 1000, async (chunkRows) => {
    await prisma.userAvatarItem.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  log(ctx, `   ✅ Avatar items / user avatars: ${avatarItemRows.length} / ${userAvatarRows.length}`)
}

async function seedOrdersAndTransactions(
  prisma: PrismaClient,
  ctx: RuntimeSeedContext,
  customers: CustomerSeedRow[],
  addresses: AddressRow[],
  products: ProductSeedRow[],
  variants: ProductVariantSeedRow[],
  promotionIds: string[],
  rewardIds: string[],
  adminCustomerIds: string[]
): Promise<{
  orderIds: string[]
  monthlyDistribution: Array<{ month: string; orders: number }>
  customerStats: Map<string, CustomerStatsState>
  reviewCandidates: OrderItemReviewCandidate[]
  redemptionIds: string[]
}> {
  log(ctx, '\n📦 Seeding orders, order items, loyalty transactions, and redemptions...')
  const monthBuckets = applyGrowthAndSeasonality(buildMonthBuckets(ctx.from, ctx.to))
  const distribution = allocateWeightedCounts(ctx.profile.orders, monthBuckets.map((bucket) => bucket.weight))
  const monthlyDistribution = monthBuckets.map((bucket, index) => ({
    month: bucket.key,
    orders: distribution[index],
  }))

  const addressByCustomerId = new Map(addresses.map((address) => [address.customerId, address]))
  const variantsByProductId = new Map<string, ProductVariantSeedRow[]>()
  for (const variant of variants) {
    const list = variantsByProductId.get(variant.productId) ?? []
    list.push(variant)
    variantsByProductId.set(variant.productId, list)
  }

  const customerStats = new Map<string, CustomerStatsState>()
  const reviewCandidates: OrderItemReviewCandidate[] = []
  const orderRows: Array<Record<string, unknown>> = []
  const orderItemRows: Array<Record<string, unknown>> = []
  const pointsRows: Array<Record<string, unknown>> = []
  const redemptionRows: Array<Record<string, unknown>> = []
  const notificationRows: Array<Record<string, unknown>> = []
  const orderIds: string[] = []
  const promotionUsage = new Map<string, { usedCount: number; totalDiscountGiven: number }>()
  let orderSequence = 1
  let pointsSequence = 1
  let redemptionSequence = 1

  const oneYearAgo = new Date(ctx.to.getTime() - 365 * 24 * 60 * 60 * 1000)
  const highFrequencyCustomers = customers.slice(0, Math.max(1, Math.floor(customers.length * 0.15)))

  for (let monthIndex = 0; monthIndex < monthBuckets.length; monthIndex += 1) {
    const bucket = monthBuckets[monthIndex]
    const ordersInMonth = distribution[monthIndex]
    for (let monthOrderIndex = 0; monthOrderIndex < ordersInMonth; monthOrderIndex += 1) {
      const customer = ctx.rng.bool(0.38) ? ctx.rng.pick(highFrequencyCustomers) : ctx.rng.pick(customers)
      const customerAddress = addressByCustomerId.get(customer.id)
      if (!customerAddress) {
        continue
      }

      const orderDate = randomDateFromMonthBucket(ctx.rng, bucket)
      const status = pickOrderStatus(ctx.rng, orderDate, ctx.to)
      const paymentStatus = derivePaymentStatus(status, ctx.rng)
      const itemCount = ctx.rng.int(1, 4)

      const itemCandidates: ProductOrderCandidate[] = []
      let subtotal = 0
      for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
        const product = ctx.rng.pick(products)
        const productVariants = variantsByProductId.get(product.id) ?? []
        const activeVariants = productVariants.filter((variant) => variant.isActive)
        const variant = activeVariants.length > 0 ? ctx.rng.pick(activeVariants) : ctx.rng.pick(productVariants)
        if (!variant) {
          continue
        }
        const quantity = ctx.rng.int(1, product.maxQuantity ?? 3)
        itemCandidates.push({ product, variant, quantity })
        subtotal += variant.price * quantity
      }
      if (itemCandidates.length === 0) {
        continue
      }

      const promotionId = ctx.rng.bool(0.31) ? ctx.rng.pick(promotionIds) : null
      const promotionType = ctx.rng.pick(PROMOTION_TYPES)
      let discount = 0
      if (promotionId) {
        if (promotionType === 'PERCENTAGE') {
          discount = subtotal * ctx.rng.float(0.08, 0.22)
        } else if (promotionType === 'FIXED_AMOUNT') {
          discount = ctx.rng.int(5, 35)
        } else if (promotionType === 'BOGO') {
          discount = subtotal * 0.15
        }
      }
      discount = toTwoDecimals(Math.min(discount, subtotal * 0.65))

      const shipping = subtotal >= FREE_SHIPPING_THRESHOLD || ctx.rng.bool(0.2) ? 0 : toTwoDecimals(ctx.rng.float(4.99, 12.99))
      const taxableAmount = Math.max(0, subtotal - discount) + shipping
      const taxRate = ctx.rng.float(TAX_RATE_MIN, TAX_RATE_MAX)
      const tax = toTwoDecimals(taxableAmount * taxRate)
      const total = toTwoDecimals(Math.max(0, taxableAmount + tax))

      let redemptionId: string | null = null
      let pointsRedeemed = 0
      if (ctx.rng.bool(0.22) && redemptionRows.length < ctx.profile.rewardRedemptions) {
        redemptionId = createSeedId('hist-redemption', redemptionSequence)
        redemptionSequence += 1
        const rewardId = ctx.rng.pick(rewardIds)
        pointsRedeemed = ctx.rng.int(250, 2400)
        redemptionRows.push({
          id: redemptionId,
          customerId: customer.id,
          rewardId,
          pointsSpent: pointsRedeemed,
          status: status === 'DELIVERED' ? 'USED' : ctx.rng.pick(['ACTIVE', 'PENDING']),
          couponCode: `CARE-${String(redemptionRows.length + 1).padStart(6, '0')}`,
          usedAt: status === 'DELIVERED' ? new Date(orderDate.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
          orderId: null,
          metadata: JSON.stringify({ seeded: true }),
          idempotencyKey: `hist-redemption-key-${redemptionRows.length + 1}`,
          createdAt: orderDate,
          updatedAt: orderDate,
        })
      }

      const tracking = buildTracking(status, orderDate, ctx.rng)
      const orderId = createSeedId('hist-order', orderSequence)
      orderSequence += 1
      orderIds.push(orderId)
      const orderNumber = `HOF-${monthKey(orderDate).replace('-', '')}-${String(orderSequence).padStart(6, '0')}`

      orderRows.push({
        id: orderId,
        orderNumber,
        customerId: customer.id,
        status,
        subtotal: toTwoDecimals(subtotal),
        shipping,
        tax,
        total,
        customerEmail: customer.email,
        customerPhone: `+1-555-${ctx.rng.int(100, 999)}-${ctx.rng.int(1000, 9999)}`,
        shippingAddressId: customerAddress.id,
        billingAddressId: customerAddress.id,
        paymentMethod: ctx.rng.pick(['card', 'apple_pay', 'shop_pay']),
        paymentStatus,
        shippingMethod: shipping === 0 ? 'Free Shipping' : ctx.rng.pick(['Standard', 'Express']),
        trackingNumber: tracking.trackingNumber,
        trackingUrl: tracking.trackingNumber ? `https://tracking.headoverfeels.com/${tracking.trackingNumber}` : null,
        carrier: tracking.carrier,
        shippedAt: tracking.shippedAt,
        estimatedDelivery: tracking.estimatedDelivery,
        deliveredAt: tracking.deliveredAt,
        notes: null,
        internalNotes: ctx.rng.bool(0.08) ? 'Seeded QA note' : null,
        couponCode: promotionId ? `PROMO-${promotionId.slice(-4).toUpperCase()}` : null,
        discount,
        redemptionId,
        stripePaymentIntentId: `pi_hist_${orderId}`,
        stripeRefundId: paymentStatus === 'REFUNDED' ? `re_hist_${orderId}` : null,
        createdAt: orderDate,
        updatedAt: orderDate,
      })

      for (let lineIndex = 0; lineIndex < itemCandidates.length; lineIndex += 1) {
        const candidate = itemCandidates[lineIndex]
        orderItemRows.push({
          id: createSeedId('hist-order-item', orderItemRows.length + 1),
          orderId,
          productId: candidate.product.id,
          productVariantId: candidate.variant.id,
          quantity: candidate.quantity,
          price: candidate.variant.price,
          productName: candidate.product.name,
          productImage: JSON.parse(candidate.product.images)[0] ?? null,
          variantDetails: variantLabel(candidate.variant),
        })

        if (status === 'DELIVERED' || status === 'REFUNDED') {
          reviewCandidates.push({
            orderId,
            productId: candidate.product.id,
            customerId: customer.id,
            customerName: customer.name,
            customerEmail: customer.email,
            createdAt: new Date(orderDate.getTime() + ctx.rng.int(2, 21) * 24 * 60 * 60 * 1000),
          })
        }
      }

      if (promotionId && discount > 0) {
        const current = promotionUsage.get(promotionId) ?? { usedCount: 0, totalDiscountGiven: 0 }
        current.usedCount += 1
        current.totalDiscountGiven += discount
        promotionUsage.set(promotionId, current)
      }

      const pointsEarned = paymentStatus === 'PAID'
        ? Math.max(0, Math.round(total * 10 * ctx.rng.float(1, 1.8)))
        : 0
      if (pointsEarned > 0) {
        pointsRows.push({
          id: createSeedId('hist-points-tx', pointsSequence),
          customerId: customer.id,
          points: pointsEarned,
          type: 'PURCHASE',
          description: `Points earned from order ${orderNumber}`,
          orderId,
          reviewId: null,
          redemptionId: null,
          referralId: null,
          expiresAt: new Date(orderDate.getTime() + 365 * 24 * 60 * 60 * 1000),
          isExpired: false,
          metadata: JSON.stringify({ source: 'historical-order' }),
          createdAt: orderDate,
        })
        pointsSequence += 1
      }

      if (redemptionId && pointsRedeemed > 0) {
        pointsRows.push({
          id: createSeedId('hist-points-tx', pointsSequence),
          customerId: customer.id,
          points: -pointsRedeemed,
          type: 'REDEMPTION',
          description: `Points redeemed on order ${orderNumber}`,
          orderId,
          reviewId: null,
          redemptionId,
          referralId: null,
          expiresAt: null,
          isExpired: false,
          metadata: JSON.stringify({ source: 'historical-redemption' }),
          createdAt: orderDate,
        })
        pointsSequence += 1
      }

      notificationRows.push({
        id: createSeedId('hist-customer-notification', notificationRows.length + 1),
        customerId: customer.id,
        type: 'ORDER_CONFIRMED',
        title: 'Order confirmed',
        message: `Order ${orderNumber} has been placed.`,
        isRead: ctx.rng.bool(0.5),
        readAt: null,
        emailSent: true,
        pushSent: ctx.rng.bool(0.44),
        createdAt: orderDate,
      })

      const stats = customerStats.get(customer.id) ?? {
        totalSpent: 0,
        totalOrders: 0,
        annualSpend: 0,
        lastOrderDate: null,
        avgOrderValue: 0,
        currentPoints: 0,
        lifetimePoints: 0,
        annualPointsEarned: 0,
      }
      stats.totalSpent += total
      stats.totalOrders += 1
      if (!stats.lastOrderDate || orderDate > stats.lastOrderDate) {
        stats.lastOrderDate = orderDate
      }
      if (orderDate >= oneYearAgo) {
        stats.annualSpend += total
      }
      stats.currentPoints += pointsEarned - pointsRedeemed
      stats.lifetimePoints += pointsEarned
      if (orderDate >= oneYearAgo) {
        stats.annualPointsEarned += pointsEarned
      }
      customerStats.set(customer.id, stats)
    }
  }

  for (const customer of customers) {
    pointsRows.push({
      id: createSeedId('hist-points-tx', pointsSequence),
      customerId: customer.id,
      points: 120,
      type: 'ACCOUNT_CREATION',
      description: 'Welcome bonus points',
      orderId: null,
      reviewId: null,
      redemptionId: null,
      referralId: null,
      expiresAt: null,
      isExpired: false,
      metadata: JSON.stringify({ source: 'historical-signup' }),
      createdAt: customer.createdAt,
    })
    pointsSequence += 1
    const stats = customerStats.get(customer.id) ?? {
      totalSpent: 0,
      totalOrders: 0,
      annualSpend: 0,
      lastOrderDate: null,
      avgOrderValue: 0,
      currentPoints: 0,
      lifetimePoints: 0,
      annualPointsEarned: 0,
    }
    stats.currentPoints += 120
    stats.lifetimePoints += 120
    if (customer.createdAt >= oneYearAgo) {
      stats.annualPointsEarned += 120
    }
    customerStats.set(customer.id, stats)
  }

  if (pointsRows.length < ctx.profile.pointsTransactions) {
    const gap = ctx.profile.pointsTransactions - pointsRows.length
    for (let index = 0; index < gap; index += 1) {
      const customer = ctx.rng.pick(customers)
      const createdAt = randomDateBetween(ctx.rng, customer.createdAt, ctx.to)
      const type = ctx.rng.pick(['REFERRAL_GIVE', 'TIER_BONUS', 'ADMIN_ADJUSTMENT', 'BIRTHDAY'])
      const points = type === 'ADMIN_ADJUSTMENT' ? ctx.rng.int(-120, 220) : ctx.rng.int(40, 450)
      pointsRows.push({
        id: createSeedId('hist-points-tx', pointsSequence),
        customerId: customer.id,
        points,
        type,
        description: `Historical ${type.toLowerCase().replace('_', ' ')}`,
        orderId: null,
        reviewId: null,
        redemptionId: null,
        referralId: null,
        expiresAt: null,
        isExpired: false,
        metadata: JSON.stringify({ source: 'historical-adjustment' }),
        createdAt,
      })
      pointsSequence += 1

      const stats = customerStats.get(customer.id)
      if (stats) {
        stats.currentPoints += points
        if (points > 0) {
          stats.lifetimePoints += points
          if (createdAt >= oneYearAgo) {
            stats.annualPointsEarned += points
          }
        }
      }
    }
  }

  for (const [promotionId, usage] of promotionUsage.entries()) {
    await prisma.promotion.update({
      where: { id: promotionId },
      data: {
        usedCount: usage.usedCount,
        totalDiscountGiven: toTwoDecimals(usage.totalDiscountGiven),
      },
    })
  }

  await createManyChunked(redemptionRows, 1000, async (chunkRows) => {
    await prisma.rewardRedemption.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(orderRows, 1000, async (chunkRows) => {
    await prisma.order.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(orderItemRows, 1000, async (chunkRows) => {
    await prisma.orderItem.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(pointsRows, 1000, async (chunkRows) => {
    await prisma.pointsTransaction.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(notificationRows, 1000, async (chunkRows) => {
    await prisma.customerNotification.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  await prisma.customer.updateMany({
    where: { isAdmin: true },
    data: {
      loyaltyTierId: 'tier-newcomer',
      currentPoints: 0,
      lifetimePoints: 0,
      annualPointsEarned: 0,
      totalSpent: 0,
      totalOrders: 0,
      annualSpend: 0,
      avgOrderValue: 0,
    },
  })

  for (const customer of customers) {
    const stats = customerStats.get(customer.id)
    if (!stats) continue
    stats.avgOrderValue = stats.totalOrders > 0 ? toTwoDecimals(stats.totalSpent / stats.totalOrders) : 0
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        totalSpent: toTwoDecimals(stats.totalSpent),
        totalOrders: stats.totalOrders,
        lastOrderDate: stats.lastOrderDate,
        avgOrderValue: stats.avgOrderValue,
        currentPoints: Math.max(0, Math.round(stats.currentPoints)),
        lifetimePoints: Math.max(0, Math.round(stats.lifetimePoints)),
        annualPointsEarned: Math.max(0, Math.round(stats.annualPointsEarned)),
        annualSpend: toTwoDecimals(stats.annualSpend),
        loyaltyTierId: tierFromAnnualSpend(stats.annualSpend),
      },
    })
  }

  if (adminCustomerIds.length > 0) {
    const adminCreatedAt = randomDateBetween(ctx.rng, ctx.from, ctx.to)
    await prisma.pointsTransaction.create({
      data: {
        id: createSeedId('hist-points-tx', pointsSequence),
        customerId: adminCustomerIds[0],
        points: 0,
        type: 'ADMIN_ADJUSTMENT',
        description: 'Admin account baseline reset preserved during historical seed',
        createdAt: adminCreatedAt,
      },
    })
  }

  log(ctx, `   ✅ Orders: ${orderRows.length}`)
  log(ctx, `   ✅ Order items: ${orderItemRows.length}`)
  log(ctx, `   ✅ Reward redemptions: ${redemptionRows.length}`)
  log(ctx, `   ✅ Points transactions: ${pointsRows.length}`)

  return {
    orderIds,
    monthlyDistribution,
    customerStats,
    reviewCandidates,
    redemptionIds: redemptionRows.map((row) => row.id as string),
  }
}

async function seedReviewsAndEngagement(
  prisma: PrismaClient,
  ctx: RuntimeSeedContext,
  customers: CustomerSeedRow[],
  products: ProductSeedRow[],
  variants: ProductVariantSeedRow[],
  orders: string[],
  reviewCandidates: OrderItemReviewCandidate[]
): Promise<void> {
  log(ctx, '\n💬 Seeding reviews, wishlist/cart state, product views, and stock alerts...')

  const reviews: Array<Record<string, unknown>> = []
  const maxReviews = Math.min(ctx.profile.reviews, reviewCandidates.length)
  for (let index = 0; index < maxReviews; index += 1) {
    const candidate = reviewCandidates[index]
    const rating = ctx.rng.pick([3, 4, 4, 5, 5, 5])
    const hasImage = ctx.rng.bool(0.28)
    const createdAt = candidate.createdAt
    reviews.push({
      id: createSeedId('hist-review', index + 1),
      productId: candidate.productId,
      customerId: candidate.customerId,
      orderId: candidate.orderId,
      rating,
      title: ctx.rng.pick(REVIEW_HEADLINES),
      comment: `Historical seeded review (${rating} stars). Comfortable fit and quality finish.`,
      images: hasImage ? JSON.stringify([`https://cdn.headoverfeels.com/reviews/${index + 1}.jpg`]) : null,
      customerName: candidate.customerName,
      customerEmail: candidate.customerEmail,
      status: ctx.rng.bool(0.86) ? 'APPROVED' : ctx.rng.pick(['PENDING', 'REJECTED']),
      isVerified: true,
      helpfulCount: ctx.rng.int(0, 120),
      notHelpfulCount: ctx.rng.int(0, 24),
      createdAt,
      updatedAt: createdAt,
    })
  }
  await createManyChunked(reviews, 1000, async (chunkRows) => {
    await prisma.review.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  const pointsForReviews: Array<Record<string, unknown>> = []
  let pointsIdStart = 900000
  for (const review of reviews.filter((row) => row.status === 'APPROVED').slice(0, Math.floor(reviews.length * 0.6))) {
    const reviewDate = review.createdAt as Date
    pointsForReviews.push({
      id: createSeedId('hist-points-review', pointsIdStart),
      customerId: review.customerId as string,
      points: ctx.rng.int(25, 80),
      type: 'REVIEW',
      description: 'Points earned for approved product review',
      orderId: review.orderId as string,
      reviewId: review.id as string,
      redemptionId: null,
      referralId: null,
      expiresAt: null,
      isExpired: false,
      metadata: JSON.stringify({ source: 'historical-review' }),
      createdAt: reviewDate,
    })
    pointsIdStart += 1
  }
  await createManyChunked(pointsForReviews, 1000, async (chunkRows) => {
    await prisma.pointsTransaction.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  const variantsByProduct = new Map<string, ProductVariantSeedRow[]>()
  for (const variant of variants) {
    const rows = variantsByProduct.get(variant.productId) ?? []
    rows.push(variant)
    variantsByProduct.set(variant.productId, rows)
  }

  const wishlistRows: Array<Record<string, unknown>> = []
  const cartRows: Array<Record<string, unknown>> = []
  const reservationRows: Array<Record<string, unknown>> = []
  const abandonedRows: Array<Record<string, unknown>> = []
  const dropNotificationRows: Array<Record<string, unknown>> = []
  const backInStockRows: Array<Record<string, unknown>> = []

  const wishlistPerCustomer = Math.max(2, Math.floor(ctx.profile.wishlistItems / customers.length))
  const cartPerCustomer = Math.max(1, Math.floor(ctx.profile.cartItems / customers.length))

  for (let customerIndex = 0; customerIndex < customers.length; customerIndex += 1) {
    const customer = customers[customerIndex]
    for (let i = 0; i < wishlistPerCustomer; i += 1) {
      const product = products[(customerIndex * 7 + i * 13) % products.length]
      const productVariants = variantsByProduct.get(product.id) ?? []
      const variant = productVariants.length > 0 ? productVariants[(i + customerIndex) % productVariants.length] : null
      wishlistRows.push({
        id: createSeedId('hist-wishlist', wishlistRows.length + 1),
        customerId: customer.id,
        productId: product.id,
        productVariantId: variant?.id ?? null,
        notes: ctx.rng.bool(0.07) ? 'Prefer this for next drop.' : null,
        priority: ctx.rng.int(0, 3),
        createdAt: randomDateBetween(ctx.rng, customer.createdAt, ctx.to),
        updatedAt: ctx.to,
      })
    }

    for (let i = 0; i < cartPerCustomer; i += 1) {
      const product = products[(customerIndex * 11 + i * 5) % products.length]
      const productVariants = variantsByProduct.get(product.id) ?? []
      const variant = productVariants.length > 0 ? productVariants[(i + customerIndex) % productVariants.length] : null
      cartRows.push({
        id: createSeedId('hist-cart-item', cartRows.length + 1),
        customerId: customer.id,
        productId: product.id,
        productVariantId: variant?.id ?? null,
        quantity: ctx.rng.int(1, product.maxQuantity ?? 4),
        createdAt: randomDateBetween(ctx.rng, customer.createdAt, ctx.to),
        updatedAt: ctx.to,
      })
    }
  }

  const wishlistKeys = new Set(
    wishlistRows.map(
      (row) => `${row.customerId as string}:${row.productId as string}:${(row.productVariantId as string | null) ?? 'null'}`
    )
  )
  while (wishlistRows.length < ctx.profile.wishlistItems) {
    const customer = ctx.rng.pick(customers)
    const product = ctx.rng.pick(products)
    const productVariants = variantsByProduct.get(product.id) ?? []
    const variant = productVariants.length > 0 ? ctx.rng.pick(productVariants) : null
    const key = `${customer.id}:${product.id}:${variant?.id ?? 'null'}`
    if (wishlistKeys.has(key)) {
      continue
    }
    wishlistKeys.add(key)
    wishlistRows.push({
      id: createSeedId('hist-wishlist', wishlistRows.length + 1),
      customerId: customer.id,
      productId: product.id,
      productVariantId: variant?.id ?? null,
      notes: ctx.rng.bool(0.05) ? 'Fallback generated wishlist entry' : null,
      priority: ctx.rng.int(0, 3),
      createdAt: randomDateBetween(ctx.rng, customer.createdAt, ctx.to),
      updatedAt: ctx.to,
    })
  }

  const cartKeys = new Set(
    cartRows.map(
      (row) => `${row.customerId as string}:${row.productId as string}:${(row.productVariantId as string | null) ?? 'null'}`
    )
  )
  while (cartRows.length < ctx.profile.cartItems) {
    const customer = ctx.rng.pick(customers)
    const product = ctx.rng.pick(products)
    const productVariants = variantsByProduct.get(product.id) ?? []
    const variant = productVariants.length > 0 ? ctx.rng.pick(productVariants) : null
    const key = `${customer.id}:${product.id}:${variant?.id ?? 'null'}`
    if (cartKeys.has(key)) {
      continue
    }
    cartKeys.add(key)
    cartRows.push({
      id: createSeedId('hist-cart-item', cartRows.length + 1),
      customerId: customer.id,
      productId: product.id,
      productVariantId: variant?.id ?? null,
      quantity: ctx.rng.int(1, product.maxQuantity ?? 4),
      createdAt: randomDateBetween(ctx.rng, customer.createdAt, ctx.to),
      updatedAt: ctx.to,
    })
  }

  while (reservationRows.length < ctx.profile.cartReservations) {
    const product = ctx.rng.pick(products)
    const productVariants = variantsByProduct.get(product.id) ?? []
    const variant = productVariants.length > 0 ? ctx.rng.pick(productVariants) : null
    const createdAt = randomDateBetween(ctx.rng, ctx.from, ctx.to)
    reservationRows.push({
      id: createSeedId('hist-cart-reservation', reservationRows.length + 1),
      sessionId: `sess_hist_${reservationRows.length + 1}`,
      productId: product.id,
      productVariantId: variant?.id ?? null,
      quantity: ctx.rng.int(1, 3),
      expiresAt: new Date(createdAt.getTime() + ctx.rng.int(15, 180) * 60 * 1000),
      isActive: ctx.rng.bool(0.62),
      createdAt,
    })
  }

  const recoveredOrderIds = sampleWithoutReplacement(ctx.rng, orders, Math.min(Math.floor(ctx.profile.abandonedCarts * 0.24), orders.length))
  for (let index = 0; index < ctx.profile.abandonedCarts; index += 1) {
    const customer = ctx.rng.pick(customers)
    const createdAt = randomDateBetween(ctx.rng, customer.createdAt, ctx.to)
    const recoveredOrderId = index < recoveredOrderIds.length ? recoveredOrderIds[index] : null
    abandonedRows.push({
      id: createSeedId('hist-abandoned-cart', index + 1),
      customerId: customer.id,
      customerEmail: customer.email,
      customerName: customer.name,
      items: JSON.stringify([
        {
          productId: ctx.rng.pick(products).id,
          quantity: ctx.rng.int(1, 3),
        },
      ]),
      totalValue: toTwoDecimals(ctx.rng.float(18, 260)),
      itemCount: ctx.rng.int(1, 5),
      recoveryEmailSent: ctx.rng.bool(0.74),
      recoveryEmailSentAt: ctx.rng.bool(0.74) ? new Date(createdAt.getTime() + ctx.rng.int(1, 36) * 60 * 60 * 1000) : null,
      recovered: recoveredOrderId !== null,
      recoveredAt: recoveredOrderId ? new Date(createdAt.getTime() + ctx.rng.int(1, 5) * 24 * 60 * 60 * 1000) : null,
      recoveryOrderId: recoveredOrderId,
      abandonedAt: createdAt,
      expiresAt: new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000),
      discountCode: ctx.rng.bool(0.45) ? `SAVE${ctx.rng.int(10, 30)}` : null,
      discountAmount: ctx.rng.bool(0.45) ? ctx.rng.int(5, 35) : null,
      createdAt,
      updatedAt: createdAt,
    })
  }

  const limitedProducts = products.filter((product) => product.isLimitedEdition)
  while (dropNotificationRows.length < ctx.profile.dropNotifications && limitedProducts.length > 0) {
    const customer = ctx.rng.pick(customers)
    const product = ctx.rng.pick(limitedProducts)
    dropNotificationRows.push({
      id: createSeedId('hist-drop-notification', dropNotificationRows.length + 1),
      email: customer.email,
      productId: product.id,
      notified: ctx.rng.bool(0.58),
      notifiedAt: ctx.rng.bool(0.58) ? randomDateBetween(ctx.rng, product.createdAt, ctx.to) : null,
      source: ctx.rng.pick(['product-page', 'homepage', 'email-capture']),
      createdAt: randomDateBetween(ctx.rng, ctx.from, ctx.to),
    })
  }

  while (backInStockRows.length < ctx.profile.backInStockNotifications) {
    const variant = ctx.rng.pick(variants)
    backInStockRows.push({
      id: createSeedId('hist-back-in-stock', backInStockRows.length + 1),
      productId: variant.productId,
      variantId: variant.id,
      email: `${ctx.rng.pick(customers).email}`,
      customerId: ctx.rng.bool(0.84) ? ctx.rng.pick(customers).id : null,
      status: ctx.rng.pick(['PENDING', 'NOTIFIED', 'PURCHASED', 'EXPIRED']),
      notifiedAt: ctx.rng.bool(0.5) ? randomDateBetween(ctx.rng, ctx.from, ctx.to) : null,
      createdAt: randomDateBetween(ctx.rng, ctx.from, ctx.to),
      updatedAt: ctx.to,
      expiresAt: randomDateBetween(ctx.rng, ctx.from, ctx.to),
    })
  }

  await createManyChunked(wishlistRows, 1000, async (chunkRows) => {
    await prisma.wishlistItem.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(cartRows, 1000, async (chunkRows) => {
    await prisma.cartItem.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(reservationRows, 1000, async (chunkRows) => {
    await prisma.cartReservation.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(abandonedRows, 1000, async (chunkRows) => {
    await prisma.abandonedCart.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(dropNotificationRows, 1000, async (chunkRows) => {
    await prisma.dropNotification.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(backInStockRows, 1000, async (chunkRows) => {
    await prisma.backInStockNotification.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  const productViews: Array<Record<string, unknown>> = []
  for (let index = 0; index < ctx.profile.productViews; index += 1) {
    const customer = ctx.rng.bool(0.78) ? ctx.rng.pick(customers) : null
    const product = ctx.rng.pick(products)
    const viewedAt = randomDateBetween(ctx.rng, ctx.from, ctx.to)
    productViews.push({
      id: createSeedId('hist-product-view', index + 1),
      productId: product.id,
      customerId: customer?.id ?? null,
      sessionId: customer ? null : `anon_${ctx.rng.int(1, 120000)}`,
      viewedAt,
      duration: ctx.rng.int(6, 420),
      source: ctx.rng.pick(['search', 'homepage', 'collection', 'recommendation', 'pdp']),
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
      ipAddress: `192.168.${ctx.rng.int(0, 255)}.${ctx.rng.int(1, 255)}`,
    })
  }
  await createManyChunked(productViews, 5000, async (chunkRows) => {
    await prisma.productView.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  log(ctx, `   ✅ Reviews: ${reviews.length}`)
  log(ctx, `   ✅ Wishlist/cart/reservations: ${wishlistRows.length}/${cartRows.length}/${reservationRows.length}`)
  log(ctx, `   ✅ Product views: ${productViews.length}`)
}

async function seedEarlyAccessGrants(
  prisma: PrismaClient,
  ctx: RuntimeSeedContext,
  customers: CustomerSeedRow[],
  products: ProductSeedRow[],
  redemptionIds: string[]
): Promise<void> {
  const limitedProducts = products.filter((product) => product.isLimitedEdition)
  if (limitedProducts.length === 0) {
    return
  }

  const targetGrants = Math.max(300, Math.floor(ctx.profile.rewardRedemptions * 0.24))
  const rows: Array<Record<string, unknown>> = []
  const seenKeys = new Set<string>()
  let redemptionIndex = 0

  while (rows.length < targetGrants) {
    const customer = ctx.rng.pick(customers)
    const product = ctx.rng.pick(limitedProducts)
    const key = `${customer.id}:${product.id}`
    if (seenKeys.has(key)) {
      continue
    }
    seenKeys.add(key)

    const grantType = ctx.rng.bool(0.62) ? 'TIER_BENEFIT' : 'POINTS_REDEMPTION'
    const redemptionId = grantType === 'POINTS_REDEMPTION' && redemptionIndex < redemptionIds.length
      ? redemptionIds[redemptionIndex++]
      : null
    const createdAt = randomDateBetween(ctx.rng, product.createdAt, ctx.to)

    rows.push({
      id: createSeedId('hist-early-access-grant', rows.length + 1),
      customerId: customer.id,
      productId: product.id,
      grantType,
      redemptionId,
      validUntil: new Date(createdAt.getTime() + ctx.rng.int(2, 21) * 24 * 60 * 60 * 1000),
      usedAt: ctx.rng.bool(0.38) ? new Date(createdAt.getTime() + ctx.rng.int(1, 8) * 24 * 60 * 60 * 1000) : null,
      createdAt,
    })
  }

  await createManyChunked(rows, 1000, async (chunkRows) => {
    await prisma.earlyAccessGrant.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  log(ctx, `   ✅ Early access grants: ${rows.length}`)
}

async function seedNewsletter(
  prisma: PrismaClient,
  ctx: RuntimeSeedContext,
  customers: CustomerSeedRow[],
  adminCustomerIds: string[]
): Promise<void> {
  log(ctx, '\n📨 Seeding newsletter subscribers, campaigns, and deliveries...')

  const subscribers: Array<Record<string, unknown>> = []
  const customerSubscribers = customers.filter((customer) => customer.newsletter)

  for (const customer of customerSubscribers) {
    subscribers.push({
      id: createSeedId('hist-newsletter-subscriber', subscribers.length + 1),
      email: customer.email.toLowerCase(),
      source: ctx.rng.pick(['homepage', 'footer', 'checkout', 'profile']),
      sourceDetails: 'historical-customer-sync',
      isActive: true,
      isVerified: ctx.rng.bool(0.82),
      verifiedAt: ctx.rng.bool(0.82) ? randomDateBetween(ctx.rng, customer.createdAt, ctx.to) : null,
      unsubscribedAt: null,
      unsubscribeReason: null,
      utmSource: ctx.rng.pick(['instagram', 'tiktok', 'email', 'organic']),
      utmMedium: ctx.rng.pick(['social', 'cpc', 'email']),
      utmCampaign: ctx.rng.pick(['spring-launch', 'drop-alert', 'welcome-flow']),
      createdAt: customer.createdAt,
      updatedAt: ctx.to,
    })
  }

  while (subscribers.length < ctx.profile.newsletterSubscribers) {
    const index = subscribers.length + 1
    const createdAt = randomDateBetween(ctx.rng, ctx.from, ctx.to)
    subscribers.push({
      id: createSeedId('hist-newsletter-subscriber', index),
      email: `subscriber${String(index).padStart(5, '0')}@seed.headoverfeels.test`,
      source: ctx.rng.pick(['popup', 'homepage', 'footer', 'checkout']),
      sourceDetails: 'historical-prospect',
      isActive: ctx.rng.bool(0.92),
      isVerified: ctx.rng.bool(0.78),
      verifiedAt: ctx.rng.bool(0.78) ? randomDateBetween(ctx.rng, createdAt, ctx.to) : null,
      unsubscribedAt: null,
      unsubscribeReason: null,
      utmSource: ctx.rng.pick(['organic', 'ads', 'partner']),
      utmMedium: ctx.rng.pick(['social', 'email', 'referral']),
      utmCampaign: ctx.rng.pick(['always-on', 'new-arrivals', 'holiday']),
      createdAt,
      updatedAt: createdAt,
    })
  }

  await createManyChunked(subscribers, 1000, async (chunkRows) => {
    await prisma.newsletterSubscriber.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  const campaignRows: Array<Record<string, unknown>> = []
  const sentCampaignIds: string[] = []

  for (let index = 0; index < ctx.profile.newsletterCampaigns; index += 1) {
    const createdAt = randomDateBetween(ctx.rng, ctx.from, ctx.to)
    const status = index < Math.floor(ctx.profile.newsletterCampaigns * 0.63)
      ? 'SENT'
      : index < Math.floor(ctx.profile.newsletterCampaigns * 0.78)
        ? 'FAILED'
        : index < Math.floor(ctx.profile.newsletterCampaigns * 0.9)
          ? 'QUEUED'
          : 'DRAFT'
    const id = createSeedId('hist-newsletter-campaign', index + 1)
    const audienceCount = ctx.rng.int(1200, subscribers.length)
    const sentCount = status === 'SENT' ? Math.floor(audienceCount * ctx.rng.float(0.9, 0.99)) : 0
    const failedCount = status === 'FAILED' ? Math.floor(audienceCount * ctx.rng.float(0.08, 0.35)) : 0

    campaignRows.push({
      id,
      name: `${ctx.rng.pick(NEWSLETTER_SUBJECT_PREFIX)} #${index + 1}`,
      subject: `${ctx.rng.pick(NEWSLETTER_SUBJECT_PREFIX)} • ${DATE_FORMATTER.format(createdAt)}`,
      preheader: 'New arrivals, offers, and wellness essentials.',
      heroImageUrl: `https://cdn.headoverfeels.com/newsletter/campaign-${index + 1}.jpg`,
      ctaLabel: 'Shop Now',
      ctaUrl: '/products',
      bodyMarkdown: `## Campaign ${index + 1}\n\nCurated picks and updates for this cycle.`,
      status,
      audienceFilter: { active: true, source: 'all' },
      audienceCount,
      sentCount,
      failedCount,
      createdByAdminId: adminCustomerIds[index % adminCustomerIds.length],
      sentAt: status === 'SENT' || status === 'FAILED' ? new Date(createdAt.getTime() + 2 * 60 * 60 * 1000) : null,
      createdAt,
      updatedAt: createdAt,
    })

    if (status === 'SENT' || status === 'FAILED') {
      sentCampaignIds.push(id)
    }
  }

  await createManyChunked(campaignRows, 200, async (chunkRows) => {
    await prisma.newsletterCampaign.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  const deliveries: Array<Record<string, unknown>> = []
  const subscribersByEmail = subscribers.map((row) => ({
    id: row.id as string,
    email: row.email as string,
  }))
  const deliveryTargets = allocateWeightedCounts(
    ctx.profile.newsletterDeliveries,
    sentCampaignIds.map((_, index) => 1 + (index % 4) * 0.25)
  )
  const campaignDeliveryStats = new Map<string, { audienceCount: number; sentCount: number; failedCount: number }>()

  for (let campaignIndex = 0; campaignIndex < sentCampaignIds.length; campaignIndex += 1) {
    const campaignId = sentCampaignIds[campaignIndex]
    const targetCount = Math.min(deliveryTargets[campaignIndex], subscribersByEmail.length)
    const recipients = sampleWithoutReplacement(ctx.rng, subscribersByEmail, targetCount)
    let sentCount = 0
    let failedCount = 0

    for (const subscriber of recipients) {
      const isFailed = ctx.rng.bool(0.06)
      if (isFailed) failedCount += 1
      else sentCount += 1

      deliveries.push({
        id: createSeedId('hist-newsletter-delivery', deliveries.length + 1),
        campaignId,
        subscriberId: subscriber.id,
        email: subscriber.email,
        status: isFailed ? 'FAILED' : 'SENT',
        providerMessageId: isFailed ? null : `resend_hist_${deliveries.length + 1}`,
        errorMessage: isFailed ? 'Mailbox unavailable' : null,
        sentAt: isFailed ? null : randomDateBetween(ctx.rng, ctx.from, ctx.to),
        isTest: false,
        createdAt: randomDateBetween(ctx.rng, ctx.from, ctx.to),
        updatedAt: ctx.to,
      })
    }

    campaignDeliveryStats.set(campaignId, {
      audienceCount: recipients.length,
      sentCount,
      failedCount,
    })
  }

  await createManyChunked(deliveries, 1000, async (chunkRows) => {
    await prisma.newsletterCampaignDelivery.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  for (const campaignRow of campaignRows) {
    const id = campaignRow.id as string
    const stats = campaignDeliveryStats.get(id)
    if (!stats) {
      continue
    }

    await prisma.newsletterCampaign.update({
      where: { id },
      data: {
        audienceCount: stats.audienceCount,
        sentCount: stats.sentCount,
        failedCount: stats.failedCount,
      },
    })
  }

  log(ctx, `   ✅ Newsletter subscribers: ${subscribers.length}`)
  log(ctx, `   ✅ Newsletter campaigns: ${campaignRows.length}`)
  log(ctx, `   ✅ Newsletter deliveries: ${deliveries.length}`)
}

async function seedSupportAiAndOps(
  prisma: PrismaClient,
  ctx: RuntimeSeedContext,
  customers: CustomerSeedRow[],
  orderIds: string[],
  adminUserIds: string[],
  expenseCategoryIds: string[]
): Promise<void> {
  log(ctx, '\n🛠️  Seeding support, AI, financial, and gift-card operations...')

  const supportTicketRows: Array<Record<string, unknown>> = []
  const supportMessageRows: Array<Record<string, unknown>> = []
  const liveChatSessionRows: Array<Record<string, unknown>> = []
  const liveChatMessageRows: Array<Record<string, unknown>> = []
  const aiConversationRows: Array<Record<string, unknown>> = []
  const aiMessageRows: Array<Record<string, unknown>> = []
  const aiPendingActionRows: Array<Record<string, unknown>> = []
  const auditLogRows: Array<Record<string, unknown>> = []

  for (let index = 0; index < ctx.profile.supportTickets; index += 1) {
    const customer = ctx.rng.pick(customers)
    const orderId = ctx.rng.bool(0.7) ? ctx.rng.pick(orderIds) : null
    const createdAt = randomDateBetween(ctx.rng, customer.createdAt, ctx.to)
    const ticketId = createSeedId('hist-ticket', index + 1)
    supportTicketRows.push({
      id: ticketId,
      ticketNumber: `TKT-${String(2023 + (index % 3)).padStart(4, '0')}-${String(index + 1).padStart(6, '0')}`,
      type: ctx.rng.pick(['REFUND', 'RETURN', 'EXCHANGE', 'ORDER_ISSUE', 'PRODUCT_QUESTION', 'SHIPPING_ISSUE', 'GENERAL']),
      status: ctx.rng.pick(['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED']),
      priority: ctx.rng.pick(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
      subject: ctx.rng.pick(SUPPORT_SUBJECTS),
      customerId: customer.id,
      customerEmail: customer.email,
      customerName: customer.name,
      orderId,
      orderNumber: orderId ? `HOF-LINKED-${orderId.slice(-6)}` : null,
      refundAmount: ctx.rng.bool(0.28) ? toTwoDecimals(ctx.rng.float(12, 220)) : null,
      refundReason: ctx.rng.bool(0.28) ? 'Customer requested return' : null,
      returnRequested: ctx.rng.bool(0.35),
      returnApproved: ctx.rng.bool(0.22) ? ctx.rng.bool(0.7) : null,
      returnLabel: ctx.rng.bool(0.2) ? `https://labels.headoverfeels.com/${ticketId}.pdf` : null,
      assignedToId: adminUserIds.length > 0 && ctx.rng.bool(0.76) ? ctx.rng.pick(adminUserIds) : null,
      assignedAt: ctx.rng.bool(0.76) ? new Date(createdAt.getTime() + 60 * 60 * 1000) : null,
      resolvedAt: ctx.rng.bool(0.58) ? new Date(createdAt.getTime() + ctx.rng.int(1, 15) * 24 * 60 * 60 * 1000) : null,
      resolvedBy: adminUserIds.length > 0 && ctx.rng.bool(0.58) ? ctx.rng.pick(adminUserIds) : null,
      resolution: ctx.rng.bool(0.58) ? 'Resolved with replacement / refund policy.' : null,
      aiAssisted: ctx.rng.bool(0.32),
      aiSummary: ctx.rng.bool(0.32) ? 'Customer issue categorized and response drafted.' : null,
      createdAt,
      updatedAt: createdAt,
    })

    const messageCount = ctx.rng.int(2, 6)
    for (let messageIndex = 0; messageIndex < messageCount; messageIndex += 1) {
      supportMessageRows.push({
        id: createSeedId('hist-ticket-message', supportMessageRows.length + 1),
        ticketId,
        message: messageIndex % 2 === 0
          ? 'Customer provided additional details and screenshots.'
          : 'Support agent responded with next steps.',
        isInternal: messageIndex > 0 && ctx.rng.bool(0.2),
        senderType: messageIndex % 2 === 0 ? 'customer' : 'admin',
        senderId: messageIndex % 2 === 0 ? customer.id : adminUserIds[0] ?? null,
        senderName: messageIndex % 2 === 0 ? customer.name : 'Support Agent',
        attachments: ctx.rng.bool(0.16) ? JSON.stringify([`https://cdn.headoverfeels.com/support/${ticketId}-${messageIndex}.jpg`]) : null,
        createdAt: new Date(createdAt.getTime() + messageIndex * 60 * 60 * 1000),
      })
    }
  }

  while (supportMessageRows.length < ctx.profile.supportMessages && supportTicketRows.length > 0) {
    const ticket = ctx.rng.pick(supportTicketRows)
    const createdAt = ticket.createdAt as Date
    supportMessageRows.push({
      id: createSeedId('hist-ticket-message', supportMessageRows.length + 1),
      ticketId: ticket.id as string,
      message: 'Follow-up message for historical support thread.',
      isInternal: ctx.rng.bool(0.18),
      senderType: ctx.rng.bool(0.5) ? 'customer' : 'admin',
      senderId: ctx.rng.bool(0.5) ? (ticket.customerId as string) : (adminUserIds[0] ?? null),
      senderName: ctx.rng.bool(0.5) ? (ticket.customerName as string) : 'Support Agent',
      attachments: null,
      createdAt: new Date(createdAt.getTime() + ctx.rng.int(2, 72) * 60 * 60 * 1000),
    })
  }

  const liveChatTicketSubset = sampleWithoutReplacement(
    ctx.rng,
    supportTicketRows,
    Math.min(ctx.profile.liveChatSessions, supportTicketRows.length)
  )
  for (const ticket of liveChatTicketSubset) {
    const sessionId = createSeedId('hist-live-chat-session', liveChatSessionRows.length + 1)
    const ticketCreatedAt = ticket.createdAt as Date
    liveChatSessionRows.push({
      id: sessionId,
      sessionId: `chat_${sessionId}`,
      ticketId: ticket.id as string,
      customerId: ticket.customerId as string,
      adminId: adminUserIds.length > 0 ? adminUserIds[(liveChatSessionRows.length + 1) % adminUserIds.length] : null,
      status: ctx.rng.pick(['WAITING', 'ACTIVE', 'CLOSED']),
      requestedAt: ticketCreatedAt,
      acceptedAt: new Date(ticketCreatedAt.getTime() + ctx.rng.int(1, 15) * 60 * 1000),
      closedAt: ctx.rng.bool(0.7) ? new Date(ticketCreatedAt.getTime() + ctx.rng.int(20, 180) * 60 * 1000) : null,
      customerName: ticket.customerName as string,
      customerEmail: ticket.customerEmail as string,
      waitTime: ctx.rng.int(1, 22),
      duration: ctx.rng.int(5, 55),
      preChatContext: 'Customer requested order help',
      issueCategory: 'order',
      issueSummary: 'Order update request',
      createdAt: ticketCreatedAt,
      updatedAt: ticketCreatedAt,
    })
  }

  for (let index = 0; index < ctx.profile.liveChatMessages; index += 1) {
    const session = liveChatSessionRows[index % liveChatSessionRows.length]
    const createdAt = (session.createdAt as Date) ?? ctx.from
    liveChatMessageRows.push({
      id: createSeedId('hist-live-chat-message', index + 1),
      sessionId: session.id as string,
      message: index % 2 === 0 ? 'Hi, I need help with my order.' : 'I can help with that right now.',
      senderType: index % 2 === 0 ? 'customer' : 'admin',
      senderId: index % 2 === 0 ? session.customerId : session.adminId,
      senderName: index % 2 === 0 ? session.customerName : 'Support Agent',
      isRead: ctx.rng.bool(0.9),
      readAt: new Date(createdAt.getTime() + ctx.rng.int(1, 30) * 60 * 1000),
      createdAt: new Date(createdAt.getTime() + index * 2 * 60 * 1000),
    })
  }

  for (let index = 0; index < ctx.profile.aiConversations; index += 1) {
    const customer = ctx.rng.pick(customers)
    const conversationId = createSeedId('hist-ai-conversation', index + 1)
    const createdAt = randomDateBetween(ctx.rng, customer.createdAt, ctx.to)
    aiConversationRows.push({
      id: conversationId,
      title: ctx.rng.pick(['Order Assistant', 'Product Sizing Help', 'Rewards Assistant']),
      customerId: customer.id,
      adminId: adminUserIds.length > 0 && ctx.rng.bool(0.22) ? ctx.rng.pick(adminUserIds) : null,
      isActive: ctx.rng.bool(0.22),
      messageCount: 0,
      createdAt,
      updatedAt: createdAt,
    })
  }

  for (let index = 0; index < ctx.profile.aiMessages; index += 1) {
    const conversation = aiConversationRows[index % aiConversationRows.length]
    const role = index % 2 === 0 ? 'USER' : 'ASSISTANT'
    const content = role === 'USER' ? ctx.rng.pick(AI_MESSAGE_SAMPLES.user) : ctx.rng.pick(AI_MESSAGE_SAMPLES.assistant)
    aiMessageRows.push({
      id: createSeedId('hist-ai-message', index + 1),
      conversationId: conversation.id as string,
      role,
      content,
      toolCalls: role === 'ASSISTANT' && ctx.rng.bool(0.1) ? JSON.stringify([{ tool: 'lookup_order' }]) : null,
      toolResults: role === 'ASSISTANT' && ctx.rng.bool(0.1) ? JSON.stringify({ ok: true }) : null,
      createdAt: new Date((conversation.createdAt as Date).getTime() + index * 60 * 1000),
    })
  }

  for (let index = 0; index < ctx.profile.aiPendingActions; index += 1) {
    const conversation = aiConversationRows[index % aiConversationRows.length]
    const createdAt = conversation.createdAt as Date
    aiPendingActionRows.push({
      id: createSeedId('hist-ai-action', index + 1),
      conversationId: conversation.id as string,
      actionType: ctx.rng.pick(['ORDER_UPDATE', 'REFUND_REQUEST', 'TIER_CHECK']),
      actionPayload: JSON.stringify({ index }),
      description: 'Pending action generated from AI conversation',
      status: ctx.rng.pick(['PENDING', 'CONFIRMED', 'REJECTED', 'EXECUTED']),
      executedAt: ctx.rng.bool(0.35) ? new Date(createdAt.getTime() + 5 * 60 * 1000) : null,
      result: ctx.rng.bool(0.35) ? JSON.stringify({ ok: true }) : null,
      expiresAt: new Date(createdAt.getTime() + 48 * 60 * 60 * 1000),
      createdAt,
    })
  }

  if (adminUserIds.length > 0) {
    for (let index = 0; index < 650; index += 1) {
      const adminId = adminUserIds[index % adminUserIds.length]
      auditLogRows.push({
        id: createSeedId('hist-admin-audit-log', index + 1),
        adminId,
        adminEmail: `admin-${adminId}@seed.headoverfeels.test`,
        adminName: 'Admin User',
        action: ctx.rng.pick(['CREATE', 'UPDATE', 'STATUS_CHANGE', 'EXPORT', 'ASSIGN']),
        category: ctx.rng.pick(['ORDER', 'PRODUCT', 'CUSTOMER', 'SUPPORT_TICKET', 'PROMOTION', 'LOYALTY']),
        targetId: createSeedId('target', ctx.rng.int(1, 99999)),
        targetType: ctx.rng.pick(['order', 'product', 'customer', 'ticket']),
        targetLabel: 'Historical seeded action',
        description: 'Automated historical admin log entry',
        changes: JSON.stringify({ seeded: true }),
        metadata: JSON.stringify({ source: 'historical-seeder' }),
        ipAddress: `10.0.${ctx.rng.int(0, 255)}.${ctx.rng.int(1, 255)}`,
        userAgent: 'Mozilla/5.0',
        createdAt: randomDateBetween(ctx.rng, ctx.from, ctx.to),
      })
    }
  }

  await createManyChunked(supportTicketRows, 1000, async (chunkRows) => {
    await prisma.supportTicket.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(supportMessageRows, 1000, async (chunkRows) => {
    await prisma.supportMessage.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(liveChatSessionRows, 500, async (chunkRows) => {
    await prisma.liveChatSession.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(liveChatMessageRows, 1000, async (chunkRows) => {
    await prisma.liveChatMessage.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(aiConversationRows, 500, async (chunkRows) => {
    await prisma.aiConversation.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(aiMessageRows, 1000, async (chunkRows) => {
    await prisma.aiMessage.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(aiPendingActionRows, 1000, async (chunkRows) => {
    await prisma.aiPendingAction.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(auditLogRows, 1000, async (chunkRows) => {
    await prisma.adminAuditLog.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  const invoiceRows: Array<Record<string, unknown>> = []
  for (let index = 0; index < ctx.profile.invoices; index += 1) {
    const issueDate = randomDateBetween(ctx.rng, ctx.from, ctx.to)
    const subtotal = toTwoDecimals(ctx.rng.float(120, 2200))
    const tax = toTwoDecimals(subtotal * ctx.rng.float(0.03, 0.11))
    invoiceRows.push({
      id: createSeedId('hist-invoice', index + 1),
      invoiceNumber: `INV-HIST-${String(index + 1).padStart(6, '0')}`,
      vendorName: ctx.rng.pick(['Logistics Co', 'Meta Ads', 'Cloud Tools', 'Apparel Partner', 'Packaging Inc']),
      vendorEmail: `billing${index + 1}@vendor.test`,
      vendorAddress: 'Vendor HQ',
      description: 'Seeded operational invoice',
      subtotal,
      tax,
      total: toTwoDecimals(subtotal + tax),
      issueDate,
      dueDate: new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000),
      paidDate: ctx.rng.bool(0.82) ? new Date(issueDate.getTime() + ctx.rng.int(5, 28) * 24 * 60 * 60 * 1000) : null,
      status: ctx.rng.pick(['PENDING', 'PAID', 'PAID', 'OVERDUE']),
      paymentMethod: ctx.rng.pick(['bank_transfer', 'card']),
      paymentReference: `pay_${index + 1}`,
      documentUrl: null,
      notes: null,
      createdAt: issueDate,
      updatedAt: issueDate,
    })
  }
  await createManyChunked(invoiceRows, 1000, async (chunkRows) => {
    await prisma.invoice.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  const expenses: Array<Record<string, unknown>> = []
  for (let index = 0; index < ctx.profile.expenses; index += 1) {
    const date = randomDateBetween(ctx.rng, ctx.from, ctx.to)
    const invoice = ctx.rng.bool(0.3) ? invoiceRows[index % invoiceRows.length] : null
    expenses.push({
      id: createSeedId('hist-expense', index + 1),
      categoryId: expenseCategoryIds[index % expenseCategoryIds.length],
      description: 'Seeded operational expense',
      amount: toTwoDecimals(ctx.rng.float(20, 1500)),
      date,
      vendor: ctx.rng.pick(['USPS', 'UPS', 'Meta', 'Stripe', 'Vendor']),
      receiptUrl: null,
      notes: null,
      isTaxDeductible: ctx.rng.bool(0.7),
      taxCategory: ctx.rng.bool(0.7) ? 'business' : null,
      paymentMethod: ctx.rng.pick(['card', 'bank_transfer', 'cash']),
      isRecurring: ctx.rng.bool(0.25),
      recurringFrequency: ctx.rng.bool(0.25) ? ctx.rng.pick(['monthly', 'quarterly']) : null,
      status: ctx.rng.pick(['RECORDED', 'APPROVED', 'PAID']),
      invoiceId: invoice ? (invoice.id as string) : null,
      createdAt: date,
      updatedAt: date,
    })
  }
  await createManyChunked(expenses, 1000, async (chunkRows) => {
    await prisma.expense.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  const financialSnapshots: Array<Record<string, unknown>> = []
  const dayMs = 24 * 60 * 60 * 1000
  for (let index = 0; index < ctx.profile.financialSnapshots; index += 1) {
    const date = new Date(ctx.from.getTime() + index * dayMs)
    if (date > ctx.to) break
    const revenue = toTwoDecimals(ctx.rng.float(1800, 42000))
    const expensesAmount = toTwoDecimals(revenue * ctx.rng.float(0.35, 0.75))
    const grossProfit = toTwoDecimals(revenue * ctx.rng.float(0.25, 0.52))
    const netProfit = toTwoDecimals(grossProfit - expensesAmount * ctx.rng.float(0.4, 0.95))
    financialSnapshots.push({
      id: createSeedId('hist-financial-snapshot', index + 1),
      date,
      periodType: 'daily',
      totalRevenue: revenue,
      totalOrders: ctx.rng.int(25, 240),
      avgOrderValue: toTwoDecimals(ctx.rng.float(40, 180)),
      totalCOGS: toTwoDecimals(revenue * ctx.rng.float(0.24, 0.45)),
      totalExpenses: expensesAmount,
      grossProfit,
      grossMargin: toTwoDecimals((grossProfit / revenue) * 100),
      netProfit,
      netMargin: toTwoDecimals((netProfit / revenue) * 100),
      salesTaxCollected: toTwoDecimals(revenue * ctx.rng.float(0.02, 0.08)),
      inventoryValue: toTwoDecimals(ctx.rng.float(25000, 220000)),
      cashOnHand: toTwoDecimals(ctx.rng.float(12000, 180000)),
      createdAt: date,
    })
  }
  await createManyChunked(financialSnapshots, 1000, async (chunkRows) => {
    await prisma.financialSnapshot.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  const taxRecords: Array<Record<string, unknown>> = []
  const monthBuckets = buildMonthBuckets(ctx.from, ctx.to)
  for (let index = 0; index < monthBuckets.length; index += 1) {
    const bucket = monthBuckets[index]
    const year = bucket.start.getUTCFullYear()
    const month = bucket.start.getUTCMonth() + 1
    const quarter = Math.floor((month - 1) / 3) + 1
    const grossRevenue = toTwoDecimals(ctx.rng.float(85000, 380000))
    const taxableRevenue = toTwoDecimals(grossRevenue * ctx.rng.float(0.82, 0.98))
    const totalExpenses = toTwoDecimals(grossRevenue * ctx.rng.float(0.34, 0.72))
    const deductibleExpenses = toTwoDecimals(totalExpenses * ctx.rng.float(0.65, 0.95))
    const netIncome = toTwoDecimals(grossRevenue - totalExpenses)
    taxRecords.push({
      id: createSeedId('hist-tax-record', index + 1),
      period: 'MONTHLY',
      year,
      quarter,
      month,
      grossRevenue,
      taxableRevenue,
      salesTaxCollected: toTwoDecimals(taxableRevenue * ctx.rng.float(0.02, 0.08)),
      totalExpenses,
      deductibleExpenses,
      netIncome,
      estimatedTaxLiability: toTwoDecimals(Math.max(0, netIncome * 0.21)),
      taxPaid: toTwoDecimals(Math.max(0, netIncome * 0.16)),
      paidDate: ctx.rng.bool(0.6) ? new Date(bucket.end.getTime() + 10 * dayMs) : null,
      paymentReference: ctx.rng.bool(0.6) ? `tax-${year}-${month}` : null,
      status: ctx.rng.pick(['CALCULATED', 'FILED', 'PAID', 'DRAFT']),
      notes: null,
      documentUrls: null,
      createdAt: bucket.end,
      updatedAt: bucket.end,
    })
  }
  await createManyChunked(taxRecords, 500, async (chunkRows) => {
    await prisma.taxRecord.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  const salesGoalHistoryRows: Array<Record<string, unknown>> = []
  for (const bucket of monthBuckets) {
    const achieved = toTwoDecimals(ctx.rng.float(120000, 320000))
    const target = 180000
    salesGoalHistoryRows.push({
      id: createSeedId('hist-sales-goal-history', salesGoalHistoryRows.length + 1),
      salesGoalsId: 'default',
      period: 'monthly',
      periodStart: bucket.start,
      periodEnd: bucket.end,
      target,
      achieved,
      percentage: toTwoDecimals((achieved / target) * 100),
      metGoal: achieved >= target,
      createdAt: bucket.end,
    })
  }
  await createManyChunked(salesGoalHistoryRows, 500, async (chunkRows) => {
    await prisma.salesGoalHistory.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  const giftCardRows: Array<Record<string, unknown>> = []
  const giftCardTransactionRows: Array<Record<string, unknown>> = []
  const orderGiftCardRows: Array<Record<string, unknown>> = []
  const giftCardApplyOrders = sampleWithoutReplacement(ctx.rng, orderIds, Math.min(ctx.profile.orderGiftCards, orderIds.length))

  for (let index = 0; index < ctx.profile.giftCards; index += 1) {
    const customer = ctx.rng.pick(customers)
    const createdAt = randomDateBetween(ctx.rng, customer.createdAt, ctx.to)
    const amount = ctx.rng.pick([25, 50, 75, 100, 150, 200])
    const redeemed = ctx.rng.bool(0.46) ? toTwoDecimals(ctx.rng.float(5, amount)) : 0
    const currentBalance = toTwoDecimals(Math.max(0, amount - redeemed))
    const giftCardId = createSeedId('hist-gift-card', index + 1)
    giftCardRows.push({
      id: giftCardId,
      code: `HOFGC${String(index + 1).padStart(8, '0')}`,
      initialBalance: amount,
      currentBalance,
      currency: 'USD',
      status: currentBalance === 0 ? 'DEPLETED' : 'ACTIVE',
      expiresAt: new Date(createdAt.getTime() + 2 * 365 * dayMs),
      purchasedById: customer.id,
      purchaseOrderId: ctx.rng.bool(0.55) ? ctx.rng.pick(orderIds) : null,
      recipientEmail: ctx.rng.bool(0.5) ? `recipient${index + 1}@example.test` : customer.email,
      recipientName: ctx.rng.bool(0.5) ? pickCustomerName(ctx.rng) : customer.name,
      senderName: customer.name,
      personalMessage: 'Enjoy this gift card!',
      redeemedById: currentBalance < amount ? customer.id : null,
      createdAt,
      updatedAt: createdAt,
    })

    giftCardTransactionRows.push({
      id: createSeedId('hist-gift-card-tx', giftCardTransactionRows.length + 1),
      giftCardId,
      type: 'INITIAL_LOAD',
      amount,
      balanceAfter: amount,
      orderId: null,
      description: 'Initial gift card load',
      customerId: customer.id,
      createdAt,
    })

    if (redeemed > 0 && giftCardTransactionRows.length < ctx.profile.giftCardTransactions) {
      giftCardTransactionRows.push({
        id: createSeedId('hist-gift-card-tx', giftCardTransactionRows.length + 1),
        giftCardId,
        type: 'REDEMPTION',
        amount: redeemed,
        balanceAfter: currentBalance,
        orderId: ctx.rng.pick(orderIds),
        description: 'Gift card redemption during checkout',
        customerId: customer.id,
        createdAt: new Date(createdAt.getTime() + ctx.rng.int(1, 180) * dayMs),
      })
    }
  }

  while (giftCardTransactionRows.length < ctx.profile.giftCardTransactions) {
    const card = ctx.rng.pick(giftCardRows)
    giftCardTransactionRows.push({
      id: createSeedId('hist-gift-card-tx', giftCardTransactionRows.length + 1),
      giftCardId: card.id as string,
      type: ctx.rng.pick(['ADJUSTMENT', 'REFUND']),
      amount: toTwoDecimals(ctx.rng.float(1, 40)),
      balanceAfter: toTwoDecimals(ctx.rng.float(0, card.currentBalance as number)),
      orderId: ctx.rng.bool(0.7) ? ctx.rng.pick(orderIds) : null,
      description: 'Operational gift card adjustment',
      customerId: card.purchasedById as string,
      createdAt: randomDateBetween(ctx.rng, card.createdAt as Date, ctx.to),
    })
  }

  for (let index = 0; index < giftCardApplyOrders.length; index += 1) {
    const orderId = giftCardApplyOrders[index]
    const card = giftCardRows[index % giftCardRows.length]
    orderGiftCardRows.push({
      id: createSeedId('hist-order-gift-card', index + 1),
      orderId,
      giftCardId: card.id as string,
      amountApplied: toTwoDecimals(ctx.rng.float(5, Math.min(80, card.currentBalance as number))),
      createdAt: randomDateBetween(ctx.rng, ctx.from, ctx.to),
    })
  }

  await createManyChunked(giftCardRows, 1000, async (chunkRows) => {
    await prisma.giftCard.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(giftCardTransactionRows, 1000, async (chunkRows) => {
    await prisma.giftCardTransaction.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
  await createManyChunked(orderGiftCardRows, 1000, async (chunkRows) => {
    await prisma.orderGiftCard.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })

  log(ctx, `   ✅ Support tickets/messages: ${supportTicketRows.length}/${supportMessageRows.length}`)
  log(ctx, `   ✅ Live chat sessions/messages: ${liveChatSessionRows.length}/${liveChatMessageRows.length}`)
  log(ctx, `   ✅ AI conversations/messages/actions: ${aiConversationRows.length}/${aiMessageRows.length}/${aiPendingActionRows.length}`)
  log(ctx, `   ✅ Invoices/expenses/snapshots: ${invoiceRows.length}/${expenses.length}/${financialSnapshots.length}`)
  log(ctx, `   ✅ Gift cards/transactions: ${giftCardRows.length}/${giftCardTransactionRows.length}`)
}

async function seedMiscCustomerNotifications(
  prisma: PrismaClient,
  ctx: RuntimeSeedContext,
  customers: CustomerSeedRow[]
): Promise<void> {
  const existingCount = await prisma.customerNotification.count()
  if (existingCount >= ctx.profile.customerNotifications) {
    return
  }

  const notifications: Array<Record<string, unknown>> = []
  while (existingCount + notifications.length < ctx.profile.customerNotifications) {
    const customer = ctx.rng.pick(customers)
    const createdAt = randomDateBetween(ctx.rng, customer.createdAt, ctx.to)
    const type = ctx.rng.pick(NOTIFICATION_TYPES)
    notifications.push({
      id: createSeedId('hist-customer-notification-extra', notifications.length + 1),
      customerId: customer.id,
      type,
      title: `${type.replace(/_/g, ' ')} update`,
      message: 'Historical seeded notification event.',
      linkUrl: ctx.rng.bool(0.45) ? '/profile' : null,
      linkLabel: ctx.rng.bool(0.45) ? 'View' : null,
      metadata: null,
      isRead: ctx.rng.bool(0.6),
      readAt: ctx.rng.bool(0.6) ? new Date(createdAt.getTime() + ctx.rng.int(5, 500) * 60 * 1000) : null,
      emailSent: ctx.rng.bool(0.7),
      pushSent: ctx.rng.bool(0.45),
      createdAt,
    })
  }

  await createManyChunked(notifications, 1000, async (chunkRows) => {
    await prisma.customerNotification.createMany({ data: chunkRows as never[], skipDuplicates: true })
  })
}

function createTierDistributionRows(stats: Map<string, CustomerStatsState>): Record<string, number> {
  const distribution: Record<string, number> = {
    newcomer: 0,
    friend: 0,
    heart: 0,
    bestie: 0,
  }

  for (const state of stats.values()) {
    const tier = tierFromAnnualSpend(state.annualSpend)
    if (tier === 'tier-newcomer') distribution.newcomer += 1
    if (tier === 'tier-friend') distribution.friend += 1
    if (tier === 'tier-heart') distribution.heart += 1
    if (tier === 'tier-bestie') distribution.bestie += 1
  }

  return distribution
}

async function collectModelCounts(prisma: PrismaClient): Promise<ModelCounts> {
  const [
    adminUsers,
    adminAuditLogs,
    categories,
    collections,
    products,
    collectionProducts,
    variants,
    customers,
    addresses,
    orders,
    orderItems,
    cartItems,
    abandonedCarts,
    wishlistItems,
    dropNotifications,
    cartReservations,
    reviews,
    productViews,
    productRecommendations,
    backInStockNotifications,
    loyaltySettings,
    salesGoals,
    salesGoalHistory,
    loyaltyTiers,
    pointsTransactions,
    rewards,
    rewardRedemptions,
    referrals,
    supportTickets,
    supportMessages,
    liveChatSessions,
    liveChatMessages,
    aiConversations,
    aiMessages,
    aiPendingActions,
    expenseCategories,
    expenses,
    invoices,
    budgets,
    taxRecords,
    financialSnapshots,
    promotions,
    marketingPopups,
    popupVariants,
    popupAnalytics,
    giftCards,
    giftCardTransactions,
    orderGiftCards,
    newsletterSubscribers,
    newsletterCampaigns,
    newsletterCampaignDeliveries,
    customerNotifications,
    notificationPreferences,
    customerNotes,
    avatarItems,
    userAvatars,
    userAvatarItems,
    accounts,
    sessions,
    verificationTokens,
    dropEarlyAccess,
    earlyAccessGrants,
  ] = await Promise.all([
    prisma.adminUser.count(),
    prisma.adminAuditLog.count(),
    prisma.category.count(),
    prisma.collection.count(),
    prisma.product.count(),
    prisma.collectionProduct.count(),
    prisma.productVariant.count(),
    prisma.customer.count(),
    prisma.address.count(),
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.cartItem.count(),
    prisma.abandonedCart.count(),
    prisma.wishlistItem.count(),
    prisma.dropNotification.count(),
    prisma.cartReservation.count(),
    prisma.review.count(),
    prisma.productView.count(),
    prisma.productRecommendation.count(),
    prisma.backInStockNotification.count(),
    prisma.loyaltySettings.count(),
    prisma.salesGoals.count(),
    prisma.salesGoalHistory.count(),
    prisma.loyaltyTier.count(),
    prisma.pointsTransaction.count(),
    prisma.reward.count(),
    prisma.rewardRedemption.count(),
    prisma.referralCode.count(),
    prisma.supportTicket.count(),
    prisma.supportMessage.count(),
    prisma.liveChatSession.count(),
    prisma.liveChatMessage.count(),
    prisma.aiConversation.count(),
    prisma.aiMessage.count(),
    prisma.aiPendingAction.count(),
    prisma.expenseCategory.count(),
    prisma.expense.count(),
    prisma.invoice.count(),
    prisma.budget.count(),
    prisma.taxRecord.count(),
    prisma.financialSnapshot.count(),
    prisma.promotion.count(),
    prisma.marketingPopup.count(),
    prisma.popupVariant.count(),
    prisma.popupAnalytics.count(),
    prisma.giftCard.count(),
    prisma.giftCardTransaction.count(),
    prisma.orderGiftCard.count(),
    prisma.newsletterSubscriber.count(),
    prisma.newsletterCampaign.count(),
    prisma.newsletterCampaignDelivery.count(),
    prisma.customerNotification.count(),
    prisma.notificationPreference.count(),
    prisma.customerNote.count(),
    prisma.avatarItem.count(),
    prisma.userAvatar.count(),
    prisma.userAvatarItem.count(),
    prisma.account.count(),
    prisma.session.count(),
    prisma.verificationToken.count(),
    prisma.dropEarlyAccess.count(),
    prisma.earlyAccessGrant.count(),
  ])

  return {
    adminUsers,
    adminAuditLogs,
    categories,
    collections,
    products,
    collectionProducts,
    variants,
    customers,
    addresses,
    orders,
    orderItems,
    cartItems,
    abandonedCarts,
    wishlistItems,
    dropNotifications,
    cartReservations,
    reviews,
    productViews,
    productRecommendations,
    backInStockNotifications,
    loyaltySettings,
    salesGoals,
    salesGoalHistory,
    loyaltyTiers,
    pointsTransactions,
    rewards,
    rewardRedemptions,
    referrals,
    supportTickets,
    supportMessages,
    liveChatSessions,
    liveChatMessages,
    aiConversations,
    aiMessages,
    aiPendingActions,
    expenseCategories,
    expenses,
    invoices,
    budgets,
    taxRecords,
    financialSnapshots,
    promotions,
    marketingPopups,
    popupVariants,
    popupAnalytics,
    giftCards,
    giftCardTransactions,
    orderGiftCards,
    newsletterSubscribers,
    newsletterCampaigns,
    newsletterCampaignDeliveries,
    customerNotifications,
    notificationPreferences,
    customerNotes,
    avatarItems,
    userAvatars,
    userAvatarItems,
    accounts,
    sessions,
    verificationTokens,
    dropEarlyAccess,
    earlyAccessGrants,
  }
}

export async function runHistoricalSeed(
  prisma: PrismaClient,
  options?: HistoricalSeedRunOptions
): Promise<HistoricalSeedSummary> {
  ensureNewsletterCampaignDelegate(prisma)

  const scale = normalizeHistoricalSeedScale(options?.scale ?? 'large')
  const profile = HISTORICAL_SEED_PROFILES[scale]
  const { from, to } = resolveHistoricalDateRange({
    from: options?.from,
    to: options?.to,
  })
  const seed = Number.isFinite(options?.seed) ? Number(options?.seed) : DEFAULT_HISTORICAL_SEED
  const logger = options?.logger ?? console

  const ctx: RuntimeSeedContext = {
    rng: createSeedRng(seed),
    from: parseDateString(from),
    to: parseDateString(to),
    profile,
    logger,
    seed,
  }

  const adminUsers = await prisma.adminUser.findMany({
    select: { id: true },
  })
  const adminUserIds = adminUsers.map((row) => row.id)

  if (adminUserIds.length === 0) {
    logger.warn('⚠️  No admin_users rows found. Some support/audit data will be seeded without assignees.')
  }

  const foundation = await seedFoundation(prisma, ctx, adminUserIds)
  const customerSeed = await seedCustomers(prisma, ctx, adminUserIds)
  const catalog = await seedCatalog(prisma, ctx, foundation.categoryIds, foundation.collectionIds)
  await seedAvatarData(prisma, ctx, customerSeed.customers, catalog.products)

  const ordersResult = await seedOrdersAndTransactions(
    prisma,
    ctx,
    customerSeed.customers,
    customerSeed.addresses,
    catalog.products,
    catalog.variants,
    foundation.promotionIds,
    foundation.rewardIds,
    customerSeed.adminCustomerIds
  )

  await seedEarlyAccessGrants(prisma, ctx, customerSeed.customers, catalog.products, ordersResult.redemptionIds)

  await seedReviewsAndEngagement(
    prisma,
    ctx,
    customerSeed.customers,
    catalog.products,
    catalog.variants,
    ordersResult.orderIds,
    ordersResult.reviewCandidates
  )

  await seedNewsletter(prisma, ctx, customerSeed.customers, customerSeed.adminCustomerIds)

  await seedSupportAiAndOps(
    prisma,
    ctx,
    customerSeed.customers,
    ordersResult.orderIds,
    adminUserIds,
    foundation.expenseCategoryIds
  )

  await seedMiscCustomerNotifications(prisma, ctx, customerSeed.customers)

  const modelCounts = await collectModelCounts(prisma)
  const tierDistribution = createTierDistributionRows(ordersResult.customerStats)

  const sampleAccounts: Array<{ email: string; role: 'admin' | 'customer'; passwordHint: string }> = []
  const preservedAdmins = await prisma.customer.findMany({
    where: { isAdmin: true },
    select: { email: true },
    take: 3,
    orderBy: { createdAt: 'asc' },
  })
  for (const admin of preservedAdmins) {
    sampleAccounts.push({
      email: admin.email,
      role: 'admin',
      passwordHint: 'preserved-existing-password',
    })
  }

  for (const customer of customerSeed.customers.slice(0, 3)) {
    sampleAccounts.push({
      email: customer.email,
      role: 'customer',
      passwordHint: customer.password ? DEFAULT_CUSTOMER_PASSWORD : 'password-not-set',
    })
  }

  return {
    seed,
    scale,
    from: ctx.from,
    to: ctx.to,
    monthlyOrderDistribution: ordersResult.monthlyDistribution,
    modelCounts,
    tierDistribution,
    sampleAccounts,
  }
}

export async function buildHistoricalVerificationReport(
  prisma: PrismaClient,
  options?: { from?: Date | string; to?: Date | string }
): Promise<{
  modelCounts: ModelCounts
  dateCoverage: { firstOrderDate: Date | null; lastOrderDate: Date | null; from: Date; to: Date }
  promoAndNewsletter: { promotions: number; campaigns: number; deliveries: number; subscribers: number; popups: number }
  loyalty: { pointsTransactions: number; rewards: number; redemptions: number; tiers: number }
}> {
  const { from, to } = resolveHistoricalDateRange({ from: options?.from, to: options?.to })
  const modelCounts = await collectModelCounts(prisma)

  const [firstOrder, lastOrder] = await Promise.all([
    prisma.order.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.order.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ])

  return {
    modelCounts,
    dateCoverage: {
      firstOrderDate: firstOrder?.createdAt ?? null,
      lastOrderDate: lastOrder?.createdAt ?? null,
      from,
      to,
    },
    promoAndNewsletter: {
      promotions: modelCounts.promotions,
      campaigns: modelCounts.newsletterCampaigns,
      deliveries: modelCounts.newsletterCampaignDeliveries,
      subscribers: modelCounts.newsletterSubscribers,
      popups: modelCounts.marketingPopups,
    },
    loyalty: {
      pointsTransactions: modelCounts.pointsTransactions,
      rewards: modelCounts.rewards,
      redemptions: modelCounts.rewardRedemptions,
      tiers: modelCounts.loyaltyTiers,
    },
  }
}

export function printHistoricalSeedSummary(summary: HistoricalSeedSummary): void {
  console.log('\n✅ Historical seed completed')
  console.log(`   Scale: ${summary.scale}`)
  console.log(`   Seed: ${summary.seed}`)
  console.log(`   Date window: ${formatIsoDate(summary.from)} → ${formatIsoDate(summary.to)}`)
  console.log('\n📊 Key counts')
  console.log(`   Customers: ${summary.modelCounts.customers}`)
  console.log(`   Products/Variants: ${summary.modelCounts.products}/${summary.modelCounts.variants}`)
  console.log(`   Orders/Items: ${summary.modelCounts.orders}/${summary.modelCounts.orderItems}`)
  console.log(`   Reviews: ${summary.modelCounts.reviews}`)
  console.log(`   Wishlist rows: ${summary.modelCounts.wishlistItems}`)
  console.log(`   Product views: ${summary.modelCounts.productViews}`)
  console.log(`   Points transactions: ${summary.modelCounts.pointsTransactions}`)
  console.log(`   Promotions/Popups: ${summary.modelCounts.promotions}/${summary.modelCounts.marketingPopups}`)
  console.log(`   Newsletter subscribers/campaigns/deliveries: ${summary.modelCounts.newsletterSubscribers}/${summary.modelCounts.newsletterCampaigns}/${summary.modelCounts.newsletterCampaignDeliveries}`)
  console.log(`   Support tickets/messages: ${summary.modelCounts.supportTickets}/${summary.modelCounts.supportMessages}`)
  console.log(`   Financial snapshots: ${summary.modelCounts.financialSnapshots}`)
  console.log('\n🏆 Tier distribution')
  console.log(`   Newcomer: ${summary.tierDistribution.newcomer}`)
  console.log(`   Friend: ${summary.tierDistribution.friend}`)
  console.log(`   Heart: ${summary.tierDistribution.heart}`)
  console.log(`   Bestie: ${summary.tierDistribution.bestie}`)
  console.log('\n📅 Monthly order distribution (first 6 months)')
  for (const row of summary.monthlyOrderDistribution.slice(0, 6)) {
    console.log(`   ${row.month}: ${row.orders}`)
  }
  console.log('\n🔐 Sample credentials')
  for (const account of summary.sampleAccounts) {
    console.log(`   ${account.role.toUpperCase()} -> ${account.email} (${account.passwordHint})`)
  }
  console.log('\n💡 Total seeded revenue (approx)')
  const estimatedRevenue = summary.modelCounts.orders * 72
  console.log(`   ${formatCurrency(estimatedRevenue)}`)
}
