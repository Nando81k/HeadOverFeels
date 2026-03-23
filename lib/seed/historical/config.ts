export type HistoricalSeedScale = 'light' | 'medium' | 'large'

export interface HistoricalSeedProfile {
  scale: HistoricalSeedScale
  nonAdminCustomers: number
  products: number
  variants: number
  orders: number
  reviews: number
  wishlistItems: number
  productViews: number
  newsletterSubscribers: number
  newsletterCampaigns: number
  newsletterDeliveries: number
  supportTickets: number
  supportMessages: number
  pointsTransactions: number
  rewardRedemptions: number
  abandonedCarts: number
  cartItems: number
  cartReservations: number
  dropNotifications: number
  backInStockNotifications: number
  financialSnapshots: number
  expenses: number
  invoices: number
  promotions: number
  marketingPopups: number
  popupVariants: number
  popupAnalytics: number
  giftCards: number
  giftCardTransactions: number
  orderGiftCards: number
  customerNotifications: number
  productRecommendations: number
  aiConversations: number
  aiMessages: number
  aiPendingActions: number
  liveChatSessions: number
  liveChatMessages: number
}

export const DEFAULT_HISTORICAL_SEED = 20260321
export const DEFAULT_HISTORICAL_FROM = new Date('2023-03-21T00:00:00.000Z')
export const DEFAULT_HISTORICAL_TO = new Date('2026-03-21T23:59:59.999Z')

function parseDateInput(value: Date | string, endOfDay = false): Date {
  if (value instanceof Date) {
    return new Date(value)
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
  }

  return new Date(value)
}

export const HISTORICAL_SEED_PROFILES: Record<HistoricalSeedScale, HistoricalSeedProfile> = {
  light: {
    scale: 'light',
    nonAdminCustomers: 1200,
    products: 120,
    variants: 900,
    orders: 9000,
    reviews: 2500,
    wishlistItems: 18000,
    productViews: 60000,
    newsletterSubscribers: 1800,
    newsletterCampaigns: 12,
    newsletterDeliveries: 12000,
    supportTickets: 700,
    supportMessages: 2100,
    pointsTransactions: 15000,
    rewardRedemptions: 1400,
    abandonedCarts: 2200,
    cartItems: 7000,
    cartReservations: 3000,
    dropNotifications: 1200,
    backInStockNotifications: 900,
    financialSnapshots: 365,
    expenses: 1500,
    invoices: 280,
    promotions: 14,
    marketingPopups: 8,
    popupVariants: 20,
    popupAnalytics: 1500,
    giftCards: 600,
    giftCardTransactions: 1300,
    orderGiftCards: 350,
    customerNotifications: 12000,
    productRecommendations: 2200,
    aiConversations: 300,
    aiMessages: 1700,
    aiPendingActions: 180,
    liveChatSessions: 350,
    liveChatMessages: 1800,
  },
  medium: {
    scale: 'medium',
    nonAdminCustomers: 3000,
    products: 190,
    variants: 1500,
    orders: 22000,
    reviews: 7000,
    wishlistItems: 42000,
    productViews: 140000,
    newsletterSubscribers: 4200,
    newsletterCampaigns: 22,
    newsletterDeliveries: 42000,
    supportTickets: 2800,
    supportMessages: 9800,
    pointsTransactions: 52000,
    rewardRedemptions: 4400,
    abandonedCarts: 6200,
    cartItems: 22000,
    cartReservations: 9000,
    dropNotifications: 4200,
    backInStockNotifications: 3200,
    financialSnapshots: 730,
    expenses: 5000,
    invoices: 900,
    promotions: 18,
    marketingPopups: 11,
    popupVariants: 34,
    popupAnalytics: 4200,
    giftCards: 2100,
    giftCardTransactions: 4600,
    orderGiftCards: 1200,
    customerNotifications: 42000,
    productRecommendations: 5200,
    aiConversations: 900,
    aiMessages: 5600,
    aiPendingActions: 520,
    liveChatSessions: 1200,
    liveChatMessages: 6800,
  },
  large: {
    scale: 'large',
    nonAdminCustomers: 6000,
    products: 280,
    variants: 2200,
    orders: 42000,
    reviews: 14000,
    wishlistItems: 80000,
    productViews: 260000,
    newsletterSubscribers: 7800,
    newsletterCampaigns: 36,
    newsletterDeliveries: 90000,
    supportTickets: 5200,
    supportMessages: 22000,
    pointsTransactions: 98000,
    rewardRedemptions: 8600,
    abandonedCarts: 11000,
    cartItems: 42000,
    cartReservations: 16000,
    dropNotifications: 8200,
    backInStockNotifications: 6200,
    financialSnapshots: 1096,
    expenses: 9000,
    invoices: 1800,
    promotions: 24,
    marketingPopups: 14,
    popupVariants: 52,
    popupAnalytics: 8200,
    giftCards: 4200,
    giftCardTransactions: 9400,
    orderGiftCards: 2400,
    customerNotifications: 92000,
    productRecommendations: 9000,
    aiConversations: 1600,
    aiMessages: 12000,
    aiPendingActions: 1200,
    liveChatSessions: 2600,
    liveChatMessages: 16000,
  },
}

export function normalizeHistoricalSeedScale(value: string | null | undefined): HistoricalSeedScale {
  if (!value) {
    return 'large'
  }

  if (value === 'light' || value === 'medium' || value === 'large') {
    return value
  }

  return 'large'
}

export function resolveHistoricalDateRange(options?: {
  from?: Date | string
  to?: Date | string
}): { from: Date; to: Date } {
  const from = options?.from ? parseDateInput(options.from) : new Date(DEFAULT_HISTORICAL_FROM)
  const to = options?.to ? parseDateInput(options.to, true) : new Date(DEFAULT_HISTORICAL_TO)

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Invalid historical seed date range provided')
  }

  if (from >= to) {
    throw new Error('Historical seed start date must be before end date')
  }

  return { from, to }
}
