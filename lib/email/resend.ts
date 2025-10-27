import { Resend } from 'resend';
import { render } from '@react-email/components';
import OrderConfirmationEmail from '@/emails/OrderConfirmation';
import ShippingNotificationEmail from '@/emails/ShippingNotification';

// Initialize Resend client - only if API key is available
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface OrderItem {
  productName: string;
  variantDetails: string;
  quantity: number;
  price: number;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
}

interface SendOrderConfirmationParams {
  to: string;
  orderNumber: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress: ShippingAddress;
}

interface SendShippingNotificationParams {
  to: string;
  orderNumber: string;
  customerName: string;
  trackingNumber: string;
  shippingMethod: string;
  trackingUrl?: string;
}

/**
 * Send order confirmation email to customer
 */
export async function sendOrderConfirmation(params: SendOrderConfirmationParams) {
  // Skip email sending if Resend is not configured
  if (!resend) {
    console.warn('Resend API key not configured - skipping order confirmation email');
    return { success: false, data: null };
  }

  try {
    const emailHtml = await render(
      OrderConfirmationEmail({
        orderNumber: params.orderNumber,
        customerName: params.customerName,
        items: params.items,
        subtotal: params.subtotal,
        shipping: params.shipping,
        tax: params.tax,
        total: params.total,
        shippingAddress: {
          addressLine1: params.shippingAddress.addressLine1,
          addressLine2: params.shippingAddress.addressLine2,
          city: params.shippingAddress.city,
          state: params.shippingAddress.state,
          zipCode: params.shippingAddress.zipCode,
        },
      })
    );

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Head Over Feels <orders@headoverfeels.com>',
      to: params.to,
      subject: `Order Confirmation - ${params.orderNumber}`,
      html: emailHtml,
    });

    if (error) {
      console.error('Error sending order confirmation email:', error);
      throw new Error(`Failed to send order confirmation: ${error.message}`);
    }

    console.log('Order confirmation email sent:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send order confirmation email:', error);
    throw error;
  }
}

/**
 * Send shipping notification email to customer
 */
export async function sendShippingNotification(params: SendShippingNotificationParams) {
  // Skip email sending if Resend is not configured
  if (!resend) {
    console.warn('Resend API key not configured - skipping shipping notification email');
    return { success: false, data: null };
  }

  try {
    const emailHtml = await render(
      ShippingNotificationEmail({
        orderNumber: params.orderNumber,
        customerName: params.customerName,
        trackingNumber: params.trackingNumber,
        shippingMethod: params.shippingMethod,
        trackingUrl: params.trackingUrl,
      })
    );

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Head Over Feels <shipping@headoverfeels.com>',
      to: params.to,
      subject: `Your order ${params.orderNumber} has shipped! 📦`,
      html: emailHtml,
    });

    if (error) {
      console.error('Error sending shipping notification email:', error);
      throw new Error(`Failed to send shipping notification: ${error.message}`);
    }

    console.log('Shipping notification email sent:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send shipping notification email:', error);
    throw error;
  }
}
