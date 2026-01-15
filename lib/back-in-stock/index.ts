/**
 * Back-in-Stock Notification Service
 * 
 * Manages subscriptions for out-of-stock product notifications and
 * triggers notifications when products come back in stock.
 */

import { prisma } from '@/lib/prisma'
import { BackInStockStatus } from '@prisma/client'

// ===== TYPES =====

export interface SubscribeInput {
  productId: string
  variantId?: string
  email: string
  customerId?: string
}

export interface NotificationSubscription {
  id: string
  productId: string
  variantId: string | null
  email: string
  status: BackInStockStatus
  createdAt: Date
  product: {
    id: string
    name: string
    slug: string
    images: string
  }
  variant?: {
    id: string
    size: string | null
    color: string | null
    sku: string
  } | null
}

// ===== SUBSCRIPTION MANAGEMENT =====

/**
 * Subscribe to back-in-stock notification
 */
export async function subscribeToBackInStock(input: SubscribeInput): Promise<NotificationSubscription> {
  const { productId, variantId, email, customerId } = input

  // Validate product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: variantId ? { where: { id: variantId } } : false,
    },
  })

  if (!product) {
    throw new Error('Product not found')
  }

  // Validate variant if provided
  if (variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    })
    if (!variant || variant.productId !== productId) {
      throw new Error('Variant not found or does not belong to product')
    }
  }

  // Set expiration to 90 days from now
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 90)

  // Create or update subscription
  const notification = await prisma.backInStockNotification.upsert({
    where: {
      productId_variantId_email: {
        productId,
        variantId: variantId || '',
        email,
      },
    },
    update: {
      status: 'PENDING',
      customerId,
      expiresAt,
      notifiedAt: null,
    },
    create: {
      productId,
      variantId,
      email,
      customerId,
      expiresAt,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
        },
      },
      variant: {
        select: {
          id: true,
          size: true,
          color: true,
          sku: true,
        },
      },
    },
  })

  return notification
}

/**
 * Unsubscribe from back-in-stock notification
 */
export async function unsubscribeFromBackInStock(
  productId: string,
  email: string,
  variantId?: string
): Promise<void> {
  await prisma.backInStockNotification.updateMany({
    where: {
      productId,
      variantId: variantId || null,
      email,
      status: 'PENDING',
    },
    data: {
      status: 'CANCELLED',
    },
  })
}

/**
 * Cancel all pending subscriptions for a customer
 */
export async function cancelAllSubscriptions(customerId: string): Promise<number> {
  const result = await prisma.backInStockNotification.updateMany({
    where: {
      customerId,
      status: 'PENDING',
    },
    data: {
      status: 'CANCELLED',
    },
  })

  return result.count
}

/**
 * Get customer's active subscriptions
 */
export async function getCustomerSubscriptions(
  customerId?: string,
  email?: string
): Promise<NotificationSubscription[]> {
  if (!customerId && !email) {
    return []
  }

  return prisma.backInStockNotification.findMany({
    where: {
      OR: [
        customerId ? { customerId } : {},
        email ? { email } : {},
      ].filter(Boolean),
      status: 'PENDING',
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
        },
      },
      variant: {
        select: {
          id: true,
          size: true,
          color: true,
          sku: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Check if email is subscribed to a product
 */
export async function isSubscribed(
  productId: string,
  email: string,
  variantId?: string
): Promise<boolean> {
  const subscription = await prisma.backInStockNotification.findFirst({
    where: {
      productId,
      variantId: variantId || null,
      email,
      status: 'PENDING',
    },
  })

  return !!subscription
}

// ===== NOTIFICATION TRIGGERS =====

/**
 * Get pending notifications for a product/variant that's back in stock
 */
export async function getPendingNotifications(
  productId: string,
  variantId?: string
): Promise<Array<{ id: string; email: string; customerId: string | null }>> {
  return prisma.backInStockNotification.findMany({
    where: {
      productId,
      variantId: variantId || null,
      status: 'PENDING',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: {
      id: true,
      email: true,
      customerId: true,
    },
  })
}

/**
 * Mark notifications as sent
 */
export async function markNotificationsAsSent(notificationIds: string[]): Promise<void> {
  await prisma.backInStockNotification.updateMany({
    where: {
      id: { in: notificationIds },
    },
    data: {
      status: 'NOTIFIED',
      notifiedAt: new Date(),
    },
  })
}

/**
 * Mark notification as purchased (when customer buys after being notified)
 */
export async function markNotificationAsPurchased(
  productId: string,
  email: string,
  variantId?: string
): Promise<void> {
  await prisma.backInStockNotification.updateMany({
    where: {
      productId,
      variantId: variantId || null,
      email,
      status: 'NOTIFIED',
      notifiedAt: {
        // Within 7 days of notification
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    data: {
      status: 'PURCHASED',
    },
  })
}

/**
 * Trigger back-in-stock notifications when inventory is updated
 * Call this when inventory > 0 after being 0
 */
export async function triggerBackInStockNotifications(
  productId: string,
  variantId?: string
): Promise<{ 
  notificationCount: number
  emails: string[]
}> {
  const notifications = await getPendingNotifications(productId, variantId)

  if (notifications.length === 0) {
    return { notificationCount: 0, emails: [] }
  }

  // Get product details for email
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: variantId ? { where: { id: variantId } } : false,
    },
  })

  if (!product) {
    return { notificationCount: 0, emails: [] }
  }

  const emails = notifications.map(n => n.email)
  
  // TODO: Send actual emails here
  // For now, we'll just mark them as notified
  // In production, integrate with your email service (Resend, SendGrid, etc.)
  
  console.log(`[Back-in-Stock] Sending notifications to ${emails.length} subscribers for ${product.name}`)

  // Mark as notified
  await markNotificationsAsSent(notifications.map(n => n.id))

  return {
    notificationCount: notifications.length,
    emails,
  }
}

// ===== ADMIN/ANALYTICS =====

/**
 * Get back-in-stock notification stats
 */
export async function getNotificationStats(): Promise<{
  pending: number
  notified: number
  purchased: number
  conversionRate: number
  topProducts: Array<{
    productId: string
    productName: string
    subscriberCount: number
  }>
}> {
  const [pending, notified, purchased, topProducts] = await Promise.all([
    prisma.backInStockNotification.count({ where: { status: 'PENDING' } }),
    prisma.backInStockNotification.count({ where: { status: 'NOTIFIED' } }),
    prisma.backInStockNotification.count({ where: { status: 'PURCHASED' } }),
    prisma.backInStockNotification.groupBy({
      by: ['productId'],
      where: { status: 'PENDING' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
  ])

  // Get product names for top products
  const productIds = topProducts.map(p => p.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  })
  const productMap = new Map(products.map(p => [p.id, p.name]))

  return {
    pending,
    notified,
    purchased,
    conversionRate: notified > 0 ? (purchased / notified) * 100 : 0,
    topProducts: topProducts.map(p => ({
      productId: p.productId,
      productName: productMap.get(p.productId) || 'Unknown',
      subscriberCount: p._count.id,
    })),
  }
}

/**
 * Clean up expired notifications
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  const result = await prisma.backInStockNotification.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: {
      status: 'EXPIRED',
    },
  })

  return result.count
}
