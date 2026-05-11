import { prisma } from '@/lib/prisma'
import { NotificationType, Prisma } from '@prisma/client'

/**
 * Customer Notification Service
 * Handles creating, fetching, and managing in-app notifications
 */

// ===== TYPES =====

export interface NotificationPayload {
  customerId: string
  type: NotificationType
  title: string
  message: string
  linkUrl?: string
  linkLabel?: string
  metadata?: Record<string, unknown>
}

export interface NotificationPreferences {
  inAppPointsEarned: boolean
  inAppTierUpdates: boolean
  inAppOrderUpdates: boolean
  inAppPromotions: boolean
  inAppDropAlerts: boolean
  inAppRewardReminders: boolean
  emailPointsEarned: boolean
  emailTierUpdates: boolean
  emailOrderUpdates: boolean
  emailPromotions: boolean
  emailDropAlerts: boolean
  emailRewardReminders: boolean
  emailPointsExpiring: boolean
  emailBirthdayBonus: boolean
  smsOrderUpdates: boolean
  smsDropAlerts: boolean
}

// Map notification types to preference keys
const NOTIFICATION_PREFERENCE_MAP: Record<NotificationType, { inApp: keyof NotificationPreferences; email?: keyof NotificationPreferences }> = {
  POINTS_EARNED: { inApp: 'inAppPointsEarned', email: 'emailPointsEarned' },
  POINTS_EXPIRING: { inApp: 'inAppPointsEarned', email: 'emailPointsExpiring' },
  TIER_UPGRADE: { inApp: 'inAppTierUpdates', email: 'emailTierUpdates' },
  TIER_DOWNGRADE: { inApp: 'inAppTierUpdates', email: 'emailTierUpdates' },
  ORDER_CONFIRMED: { inApp: 'inAppOrderUpdates', email: 'emailOrderUpdates' },
  ORDER_SHIPPED: { inApp: 'inAppOrderUpdates', email: 'emailOrderUpdates' },
  ORDER_DELIVERED: { inApp: 'inAppOrderUpdates', email: 'emailOrderUpdates' },
  ORDER_REFUNDED: { inApp: 'inAppOrderUpdates', email: 'emailOrderUpdates' },
  REWARD_AVAILABLE: { inApp: 'inAppRewardReminders', email: 'emailRewardReminders' },
  REWARD_REMINDER: { inApp: 'inAppRewardReminders', email: 'emailRewardReminders' },
  PROMO_NEW: { inApp: 'inAppPromotions', email: 'emailPromotions' },
  DROP_REMINDER: { inApp: 'inAppDropAlerts', email: 'emailDropAlerts' },
  DROP_LIVE: { inApp: 'inAppDropAlerts', email: 'emailDropAlerts' },
  BIRTHDAY_BONUS: { inApp: 'inAppPointsEarned', email: 'emailBirthdayBonus' },
  REFERRAL_BONUS: { inApp: 'inAppPointsEarned', email: 'emailPointsEarned' },
  REVIEW_REQUEST: { inApp: 'inAppOrderUpdates', email: 'emailOrderUpdates' },
  BACK_IN_STOCK: { inApp: 'inAppDropAlerts', email: 'emailDropAlerts' },
  WISHLIST_SALE: { inApp: 'inAppPromotions', email: 'emailPromotions' },
  GENERAL: { inApp: 'inAppPromotions' }, // General notifications always show in-app
}

// ===== NOTIFICATIONS =====

/**
 * Create a notification for a customer
 * Checks user preferences before creating
 */
export async function createNotification(payload: NotificationPayload): Promise<boolean> {
  const { customerId, type, title, message, linkUrl, linkLabel, metadata } = payload

  // Check if customer wants this type of notification
  const preferences = await getNotificationPreferences(customerId)
  const prefKey = NOTIFICATION_PREFERENCE_MAP[type]?.inApp
  
  if (prefKey && preferences && !preferences[prefKey]) {
    // User has opted out of this notification type
    return false
  }

  await prisma.customerNotification.create({
    data: {
      customerId,
      type,
      title,
      message,
      linkUrl,
      linkLabel,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  })

  return true
}

/**
 * Create multiple notifications at once
 */
export async function createNotifications(payloads: NotificationPayload[]): Promise<number> {
  let created = 0
  for (const payload of payloads) {
    const success = await createNotification(payload)
    if (success) created++
  }
  return created
}

/**
 * Get notifications for a customer
 */
export async function getNotifications(
  customerId: string,
  options?: {
    unreadOnly?: boolean
    limit?: number
    offset?: number
    types?: NotificationType[]
  }
) {
  const { unreadOnly = false, limit = 20, offset = 0, types } = options || {}

  const where: Prisma.CustomerNotificationWhereInput = {
    customerId,
    ...(unreadOnly && { isRead: false }),
    ...(types && types.length > 0 && { type: { in: types } }),
  }

  const [notifications, total] = await Promise.all([
    prisma.customerNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.customerNotification.count({ where }),
  ])

  return {
    notifications: notifications.map((n) => ({
      ...n,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
    })),
    total,
    hasMore: offset + notifications.length < total,
  }
}

/**
 * Get unread notification count for a customer
 */
export async function getUnreadCount(customerId: string): Promise<number> {
  return prisma.customerNotification.count({
    where: { customerId, isRead: false },
  })
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string, customerId: string): Promise<boolean> {
  const result = await prisma.customerNotification.updateMany({
    where: {
      id: notificationId,
      customerId, // Security: ensure customer owns this notification
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })
  return result.count > 0
}

/**
 * Mark all notifications as read for a customer
 */
export async function markAllAsRead(customerId: string): Promise<number> {
  const result = await prisma.customerNotification.updateMany({
    where: {
      customerId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })
  return result.count
}

/**
 * Delete old notifications (cleanup job)
 * Keeps last 90 days by default
 */
export async function cleanupOldNotifications(daysToKeep = 90): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  const result = await prisma.customerNotification.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
      isRead: true, // Only delete read notifications
    },
  })

  return result.count
}

// ===== PREFERENCES =====

/**
 * Get notification preferences for a customer
 * Creates default preferences if none exist
 */
export async function getNotificationPreferences(customerId: string): Promise<NotificationPreferences> {
  let prefs = await prisma.notificationPreference.findUnique({
    where: { customerId },
  })

  if (!prefs) {
    // Create default preferences
    prefs = await prisma.notificationPreference.create({
      data: { customerId },
    })
  }

  return {
    inAppPointsEarned: prefs.inAppPointsEarned,
    inAppTierUpdates: prefs.inAppTierUpdates,
    inAppOrderUpdates: prefs.inAppOrderUpdates,
    inAppPromotions: prefs.inAppPromotions,
    inAppDropAlerts: prefs.inAppDropAlerts,
    inAppRewardReminders: prefs.inAppRewardReminders,
    emailPointsEarned: prefs.emailPointsEarned,
    emailTierUpdates: prefs.emailTierUpdates,
    emailOrderUpdates: prefs.emailOrderUpdates,
    emailPromotions: prefs.emailPromotions,
    emailDropAlerts: prefs.emailDropAlerts,
    emailRewardReminders: prefs.emailRewardReminders,
    emailPointsExpiring: prefs.emailPointsExpiring,
    emailBirthdayBonus: prefs.emailBirthdayBonus,
    smsOrderUpdates: prefs.smsOrderUpdates,
    smsDropAlerts: prefs.smsDropAlerts,
  }
}

/**
 * Update notification preferences for a customer
 */
export async function updateNotificationPreferences(
  customerId: string,
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const prefs = await prisma.notificationPreference.upsert({
    where: { customerId },
    update: preferences,
    create: {
      customerId,
      ...preferences,
    },
  })

  return {
    inAppPointsEarned: prefs.inAppPointsEarned,
    inAppTierUpdates: prefs.inAppTierUpdates,
    inAppOrderUpdates: prefs.inAppOrderUpdates,
    inAppPromotions: prefs.inAppPromotions,
    inAppDropAlerts: prefs.inAppDropAlerts,
    inAppRewardReminders: prefs.inAppRewardReminders,
    emailPointsEarned: prefs.emailPointsEarned,
    emailTierUpdates: prefs.emailTierUpdates,
    emailOrderUpdates: prefs.emailOrderUpdates,
    emailPromotions: prefs.emailPromotions,
    emailDropAlerts: prefs.emailDropAlerts,
    emailRewardReminders: prefs.emailRewardReminders,
    emailPointsExpiring: prefs.emailPointsExpiring,
    emailBirthdayBonus: prefs.emailBirthdayBonus,
    smsOrderUpdates: prefs.smsOrderUpdates,
    smsDropAlerts: prefs.smsDropAlerts,
  }
}

/**
 * Check if a customer should receive a specific notification type
 */
export async function shouldSendNotification(
  customerId: string,
  type: NotificationType,
  channel: 'inApp' | 'email' | 'sms' = 'inApp'
): Promise<boolean> {
  const prefs = await getNotificationPreferences(customerId)
  const mapping = NOTIFICATION_PREFERENCE_MAP[type]
  
  if (!mapping) return true // Unknown type, allow by default
  
  if (channel === 'inApp') {
    return prefs[mapping.inApp] ?? true
  }
  
  if (channel === 'email' && mapping.email) {
    return prefs[mapping.email] ?? false
  }
  
  return false
}

// ===== HELPER FUNCTIONS FOR COMMON NOTIFICATIONS =====

/**
 * Create a points earned notification
 */
export async function notifyPointsEarned(
  customerId: string,
  points: number,
  reason: string,
  orderId?: string
) {
  return createNotification({
    customerId,
    type: 'POINTS_EARNED',
    title: `+${points} Care Points Earned!`,
    message: `You earned ${points} Care Points ${reason}.`,
    linkUrl: '/loyalty/points',
    linkLabel: 'View Points',
    metadata: { pointsEarned: points, orderId },
  })
}

/**
 * Create a tier upgrade notification
 */
export async function notifyTierUpgrade(
  customerId: string,
  newTierName: string,
  benefits: string[]
) {
  return createNotification({
    customerId,
    type: 'TIER_UPGRADE',
    title: `🎉 Welcome to ${newTierName}!`,
    message: `You've reached ${newTierName} status! Enjoy new benefits like ${benefits.slice(0, 2).join(', ')}.`,
    linkUrl: '/loyalty/tiers',
    linkLabel: 'View Benefits',
    metadata: { tierName: newTierName, benefits },
  })
}

/**
 * Create an order status notification
 */
export async function notifyOrderStatus(
  customerId: string,
  orderNumber: string,
  status: 'confirmed' | 'shipped' | 'delivered' | 'refunded',
  trackingUrl?: string
) {
  const statusMessages: Record<string, { type: NotificationType; title: string; message: string }> = {
    confirmed: {
      type: 'ORDER_CONFIRMED',
      title: 'Order Confirmed!',
      message: `Your order ${orderNumber} has been confirmed and is being prepared.`,
    },
    shipped: {
      type: 'ORDER_SHIPPED',
      title: 'Order Shipped!',
      message: `Your order ${orderNumber} is on its way! ${trackingUrl ? 'Track your package.' : ''}`,
    },
    delivered: {
      type: 'ORDER_DELIVERED',
      title: 'Order Delivered!',
      message: `Your order ${orderNumber} has been delivered. Enjoy your items!`,
    },
    refunded: {
      type: 'ORDER_REFUNDED',
      title: 'Refund Processed',
      message: `A refund for order ${orderNumber} has been processed.`,
    },
  }

  const { type, title, message } = statusMessages[status]

  return createNotification({
    customerId,
    type,
    title,
    message,
    linkUrl: `/orders/${orderNumber}`,
    linkLabel: 'View Order',
    metadata: { orderNumber, status, trackingUrl },
  })
}

/**
 * Create a drop alert notification
 */
export async function notifyDropAlert(
  customerId: string,
  dropName: string,
  isLive: boolean,
  dropUrl: string
) {
  return createNotification({
    customerId,
    type: isLive ? 'DROP_LIVE' : 'DROP_REMINDER',
    title: isLive ? `🔥 ${dropName} is LIVE!` : `⏰ ${dropName} drops soon!`,
    message: isLive
      ? `The ${dropName} limited edition drop is now available. Shop before it sells out!`
      : `Get ready! ${dropName} is dropping soon. Don't miss out!`,
    linkUrl: dropUrl,
    linkLabel: isLive ? 'Shop Now' : 'Set Reminder',
    metadata: { dropName, isLive },
  })
}

/**
 * Create a birthday bonus notification
 */
export async function notifyBirthdayBonus(customerId: string, points: number) {
  return createNotification({
    customerId,
    type: 'BIRTHDAY_BONUS',
    title: '🎂 Happy Birthday!',
    message: `We've added ${points} Care Points to your account as a birthday gift!`,
    linkUrl: '/loyalty/points',
    linkLabel: 'View Points',
    metadata: { pointsEarned: points },
  })
}

/**
 * Create a promo notification
 */
export async function notifyPromotion(
  customerId: string,
  promoName: string,
  promoCode: string,
  discount: string
) {
  return createNotification({
    customerId,
    type: 'PROMO_NEW',
    title: `🏷️ ${promoName}`,
    message: `Use code ${promoCode} to get ${discount}!`,
    linkUrl: '/products',
    linkLabel: 'Shop Now',
    metadata: { promoName, promoCode, discount },
  })
}
