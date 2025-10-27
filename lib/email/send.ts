import { resend, emailConfig } from './config'
import { generateOrderConfirmationEmail } from './templates/order-confirmation'

interface SendOrderConfirmationEmailParams {
  orderId: string
  orderNumber: string
  customerEmail: string
  items: Array<{
    product: {
      name: string
      slug: string
    }
    variant: {
      size?: string
      color?: string
      sku: string
    }
    quantity: number
    price: number
  }>
  subtotal: number
  shipping: number
  tax: number
  total: number
  shippingAddress: {
    fullName: string
    address: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  createdAt: Date
  trackingNumber?: string
  trackingUrl?: string
  carrier?: string
}

export async function sendOrderConfirmationEmail(params: SendOrderConfirmationEmailParams) {
  try {
    const emailContent = generateOrderConfirmationEmail({
      id: params.orderId,
      orderNumber: params.orderNumber,
      items: params.items,
      subtotal: params.subtotal,
      shipping: params.shipping,
      tax: params.tax,
      total: params.total,
      customerEmail: params.customerEmail,
      shippingAddress: params.shippingAddress,
      createdAt: params.createdAt,
      trackingNumber: params.trackingNumber,
      trackingUrl: params.trackingUrl,
      carrier: params.carrier,
    })

    const result = await resend.emails.send({
      from: emailConfig.from,
      to: params.customerEmail,
      replyTo: emailConfig.replyTo,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to send order confirmation email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    }
  }
}

export async function sendShipmentNotificationEmail(params: SendOrderConfirmationEmailParams) {
  // Reuse the same template but with tracking info
  return sendOrderConfirmationEmail(params)
}
