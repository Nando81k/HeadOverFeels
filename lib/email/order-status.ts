/**
 * Order Status Email Service
 * 
 * Sends email notifications for order status changes
 */

import { resend, emailConfig } from './config'
import { prisma } from '@/lib/prisma'
import {
  generateShippedEmail,
  generateDeliveredEmail,
  generateRefundEmail,
  generateOutForDeliveryEmail,
} from './templates/order-status'

interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// Helper to get full name from address
function getFullName(address: { firstName: string; lastName: string } | null | undefined): string {
  if (!address) return 'Customer'
  return `${address.firstName} ${address.lastName}`.trim() || 'Customer'
}

/**
 * Send order shipped notification
 */
export async function sendOrderShippedEmail(orderId: string): Promise<EmailResult> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            productVariant: true,
          },
        },
        customer: true,
        shippingAddress: true,
      },
    })

    if (!order) {
      return { success: false, error: 'Order not found' }
    }

    const emailData = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: getFullName(order.shippingAddress) || order.customer?.name || 'Valued Customer',
      customerEmail: order.customer?.email || order.customerEmail || '',
      trackingNumber: order.trackingNumber || undefined,
      trackingUrl: order.trackingUrl || undefined,
      carrier: order.carrier || undefined,
      items: order.items.map(item => ({
        name: item.product?.name || item.productName || 'Product',
        quantity: item.quantity,
        price: item.price,
        variant: [item.productVariant?.size, item.productVariant?.color].filter(Boolean).join(' / ') || undefined,
      })),
      total: order.total,
      shippingAddress: {
        fullName: getFullName(order.shippingAddress),
        address: order.shippingAddress?.address1 || '',
        city: order.shippingAddress?.city || '',
        state: order.shippingAddress?.state || '',
        zipCode: order.shippingAddress?.postalCode || '',
        country: order.shippingAddress?.country || 'US',
      },
    }

    if (!emailData.customerEmail) {
      return { success: false, error: 'No customer email found' }
    }

    const email = generateShippedEmail(emailData)

    const result = await resend.emails.send({
      from: emailConfig.from,
      to: emailData.customerEmail,
      replyTo: emailConfig.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })

    console.log(`Shipped email sent for order ${order.orderNumber}:`, result)

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('Error sending shipped email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    }
  }
}

/**
 * Send order delivered notification
 */
export async function sendOrderDeliveredEmail(orderId: string): Promise<EmailResult> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            productVariant: true,
          },
        },
        customer: true,
        shippingAddress: true,
      },
    })

    if (!order) {
      return { success: false, error: 'Order not found' }
    }

    const emailData = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: getFullName(order.shippingAddress) || order.customer?.name || 'Valued Customer',
      customerEmail: order.customer?.email || order.customerEmail || '',
      items: order.items.map(item => ({
        name: item.product?.name || item.productName || 'Product',
        quantity: item.quantity,
        price: item.price,
        variant: [item.productVariant?.size, item.productVariant?.color].filter(Boolean).join(' / ') || undefined,
      })),
      total: order.total,
      shippingAddress: {
        fullName: getFullName(order.shippingAddress),
        address: order.shippingAddress?.address1 || '',
        city: order.shippingAddress?.city || '',
        state: order.shippingAddress?.state || '',
        zipCode: order.shippingAddress?.postalCode || '',
        country: order.shippingAddress?.country || 'US',
      },
    }

    if (!emailData.customerEmail) {
      return { success: false, error: 'No customer email found' }
    }

    const email = generateDeliveredEmail(emailData)

    const result = await resend.emails.send({
      from: emailConfig.from,
      to: emailData.customerEmail,
      replyTo: emailConfig.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })

    console.log(`Delivered email sent for order ${order.orderNumber}:`, result)

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('Error sending delivered email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    }
  }
}

/**
 * Send refund processed notification
 */
export async function sendRefundEmail(
  orderId: string, 
  refundAmount: number,
  reason?: string
): Promise<EmailResult> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        shippingAddress: true,
      },
    })

    if (!order) {
      return { success: false, error: 'Order not found' }
    }

    const customerEmail = order.customer?.email || order.customerEmail || ''
    
    if (!customerEmail) {
      return { success: false, error: 'No customer email found' }
    }

    const emailData = {
      orderNumber: order.orderNumber,
      customerName: getFullName(order.shippingAddress) || order.customer?.name || 'Valued Customer',
      customerEmail,
      refundAmount,
      originalTotal: order.total,
      refundReason: reason,
      isPartialRefund: refundAmount < order.total,
    }

    const email = generateRefundEmail(emailData)

    const result = await resend.emails.send({
      from: emailConfig.from,
      to: emailData.customerEmail,
      replyTo: emailConfig.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })

    console.log(`Refund email sent for order ${order.orderNumber}:`, result)

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('Error sending refund email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    }
  }
}

/**
 * Send out for delivery notification
 */
export async function sendOutForDeliveryEmail(orderId: string): Promise<EmailResult> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            productVariant: true,
          },
        },
        customer: true,
        shippingAddress: true,
      },
    })

    if (!order) {
      return { success: false, error: 'Order not found' }
    }

    const emailData = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: getFullName(order.shippingAddress) || order.customer?.name || 'Valued Customer',
      customerEmail: order.customer?.email || order.customerEmail || '',
      trackingNumber: order.trackingNumber || undefined,
      trackingUrl: order.trackingUrl || undefined,
      carrier: order.carrier || undefined,
      items: order.items.map(item => ({
        name: item.product?.name || item.productName || 'Product',
        quantity: item.quantity,
        price: item.price,
        variant: [item.productVariant?.size, item.productVariant?.color].filter(Boolean).join(' / ') || undefined,
      })),
      total: order.total,
      shippingAddress: {
        fullName: getFullName(order.shippingAddress),
        address: order.shippingAddress?.address1 || '',
        city: order.shippingAddress?.city || '',
        state: order.shippingAddress?.state || '',
        zipCode: order.shippingAddress?.postalCode || '',
        country: order.shippingAddress?.country || 'US',
      },
    }

    if (!emailData.customerEmail) {
      return { success: false, error: 'No customer email found' }
    }

    const email = generateOutForDeliveryEmail(emailData)

    const result = await resend.emails.send({
      from: emailConfig.from,
      to: emailData.customerEmail,
      replyTo: emailConfig.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })

    console.log(`Out for delivery email sent for order ${order.orderNumber}:`, result)

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('Error sending out for delivery email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    }
  }
}

/**
 * Send appropriate email based on order status change
 */
export async function sendOrderStatusEmail(
  orderId: string, 
  newStatus: string,
  options?: { refundAmount?: number; refundReason?: string }
): Promise<EmailResult> {
  switch (newStatus) {
    case 'SHIPPED':
      return sendOrderShippedEmail(orderId)
    case 'OUT_FOR_DELIVERY':
      return sendOutForDeliveryEmail(orderId)
    case 'DELIVERED':
      return sendOrderDeliveredEmail(orderId)
    case 'REFUNDED':
      if (options?.refundAmount) {
        return sendRefundEmail(orderId, options.refundAmount, options.refundReason)
      }
      // Fallback: fetch order total for full refund
      const order = await prisma.order.findUnique({ where: { id: orderId } })
      if (order) {
        return sendRefundEmail(orderId, order.total, options?.refundReason)
      }
      return { success: false, error: 'Order not found for refund email' }
    default:
      return { success: false, error: `No email template for status: ${newStatus}` }
  }
}
