/**
 * Order Status Email Templates
 * 
 * Templates for shipping, delivery, and refund notification emails
 */

interface OrderStatusEmailData {
  orderId: string
  orderNumber: string
  customerName: string
  customerEmail: string
  trackingNumber?: string
  trackingUrl?: string
  carrier?: string
  items: Array<{
    name: string
    quantity: number
    price: number
    variant?: string
  }>
  total: number
  shippingAddress: {
    fullName: string
    address: string
    city: string
    state: string
    zipCode: string
    country: string
  }
}

interface RefundEmailData {
  orderNumber: string
  customerName: string
  customerEmail: string
  refundAmount: number
  originalTotal: number
  refundReason?: string
  isPartialRefund: boolean
}

const baseStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    background-color: #f9fafb;
  }
  .container {
    background-color: #ffffff;
    border-radius: 8px;
    padding: 32px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  .header {
    text-align: center;
    border-bottom: 2px solid #111827;
    padding-bottom: 20px;
    margin-bottom: 30px;
  }
  .logo {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.5px;
  }
  h1 {
    color: #111827;
    font-size: 24px;
    margin-bottom: 8px;
  }
  .highlight {
    background-color: #f0fdf4;
    border-left: 4px solid #22c55e;
    padding: 16px;
    margin: 20px 0;
    border-radius: 0 6px 6px 0;
  }
  .warning {
    background-color: #fef3c7;
    border-left: 4px solid #f59e0b;
    padding: 16px;
    margin: 20px 0;
    border-radius: 0 6px 6px 0;
  }
  .tracking-box {
    background-color: #f3f4f6;
    padding: 20px;
    border-radius: 8px;
    text-align: center;
    margin: 24px 0;
  }
  .tracking-number {
    font-family: monospace;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    letter-spacing: 1px;
  }
  .button {
    display: inline-block;
    background-color: #111827;
    color: #ffffff;
    padding: 14px 28px;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    margin-top: 12px;
  }
  .button:hover {
    background-color: #374151;
  }
  .section {
    margin-bottom: 24px;
  }
  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
  .address {
    background-color: #f9fafb;
    padding: 16px;
    border-radius: 6px;
    line-height: 1.8;
  }
  .footer {
    text-align: center;
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid #e5e7eb;
    color: #6b7280;
    font-size: 14px;
  }
  .item-list {
    margin: 16px 0;
  }
  .item {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #e5e7eb;
  }
  .refund-summary {
    background-color: #eff6ff;
    border: 1px solid #bfdbfe;
    padding: 20px;
    border-radius: 8px;
    margin: 24px 0;
  }
`

export function generateShippedEmail(data: OrderStatusEmailData): { subject: string; html: string; text: string } {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const trackingPageUrl = `${baseUrl}/orders/${data.orderId}/track`

  const itemsList = data.items.map(item => `
    <div class="item">
      <div>
        <strong>${item.name}</strong>
        ${item.variant ? `<br><small style="color: #6b7280;">${item.variant}</small>` : ''}
        <br><small style="color: #6b7280;">Qty: ${item.quantity}</small>
      </div>
      <div style="font-weight: 600;">$${(item.price * item.quantity).toFixed(2)}</div>
    </div>
  `).join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Order Has Shipped!</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">HEAD OVER FEELS</div>
    </div>
    
    <h1>📦 Your Order Has Shipped!</h1>
    <p>Hi ${data.customerName},</p>
    <p>Great news! Your order <strong>#${data.orderNumber}</strong> is on its way.</p>
    
    ${data.trackingNumber ? `
    <div class="tracking-box">
      <div class="section-title">Tracking Number</div>
      <div class="tracking-number">${data.trackingNumber}</div>
      ${data.carrier ? `<div style="color: #6b7280; margin-top: 8px;">via ${data.carrier}</div>` : ''}
      ${data.trackingUrl ? `<a href="${data.trackingUrl}" class="button">Track Package</a>` : ''}
    </div>
    ` : `
    <div class="warning">
      Tracking information will be available soon. Check back at your order page for updates.
    </div>
    `}
    
    <div class="section">
      <div class="section-title">Shipping To</div>
      <div class="address">
        ${data.shippingAddress.fullName}<br>
        ${data.shippingAddress.address}<br>
        ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zipCode}<br>
        ${data.shippingAddress.country}
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">Items in This Shipment</div>
      <div class="item-list">
        ${itemsList}
      </div>
    </div>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${trackingPageUrl}" class="button">View Order Details</a>
    </div>
    
    <div class="footer">
      <p>Questions about your order? <a href="${baseUrl}/contact">Contact our support team</a></p>
      <p>Thank you for shopping with Head Over Feels! 💖</p>
    </div>
  </div>
</body>
</html>
`

  const text = `
Your Order Has Shipped!

Hi ${data.customerName},

Great news! Your order #${data.orderNumber} is on its way.

${data.trackingNumber ? `
Tracking Number: ${data.trackingNumber}
${data.carrier ? `Carrier: ${data.carrier}` : ''}
${data.trackingUrl ? `Track your package: ${data.trackingUrl}` : ''}
` : 'Tracking information will be available soon.'}

Shipping To:
${data.shippingAddress.fullName}
${data.shippingAddress.address}
${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zipCode}
${data.shippingAddress.country}

Items:
${data.items.map(item => `- ${item.name} (Qty: ${item.quantity}) - $${(item.price * item.quantity).toFixed(2)}`).join('\n')}

View your order: ${trackingPageUrl}

Thank you for shopping with Head Over Feels!
`

  return {
    subject: `📦 Your Order #${data.orderNumber} Has Shipped!`,
    html,
    text,
  }
}

export function generateDeliveredEmail(data: OrderStatusEmailData): { subject: string; html: string; text: string } {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const reviewUrl = `${baseUrl}/orders/${data.orderNumber}/review`

  const itemsList = data.items.map(item => `
    <div class="item">
      <div>
        <strong>${item.name}</strong>
        ${item.variant ? `<br><small style="color: #6b7280;">${item.variant}</small>` : ''}
      </div>
    </div>
  `).join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Order Has Been Delivered!</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">HEAD OVER FEELS</div>
    </div>
    
    <h1>🎉 Your Order Has Been Delivered!</h1>
    <p>Hi ${data.customerName},</p>
    
    <div class="highlight">
      <strong>Great news!</strong> Your order <strong>#${data.orderNumber}</strong> has been delivered.
    </div>
    
    <div class="section">
      <div class="section-title">Delivered To</div>
      <div class="address">
        ${data.shippingAddress.fullName}<br>
        ${data.shippingAddress.address}<br>
        ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zipCode}
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">Your Items</div>
      <div class="item-list">
        ${itemsList}
      </div>
    </div>
    
    <div style="text-align: center; margin-top: 32px; padding: 24px; background-color: #fdf2f8; border-radius: 8px;">
      <h2 style="margin-bottom: 12px; color: #111827;">Love your new items? 💕</h2>
      <p style="color: #6b7280; margin-bottom: 16px;">We'd love to hear what you think! Leave a review and help others find their perfect fit.</p>
      <a href="${reviewUrl}" class="button" style="background-color: #ec4899;">Leave a Review</a>
    </div>
    
    <div class="footer">
      <p>Something not right? <a href="${baseUrl}/contact">Contact our support team</a> within 30 days for easy returns.</p>
      <p>Thank you for being part of the Head Over Feels family! 💖</p>
    </div>
  </div>
</body>
</html>
`

  const text = `
Your Order Has Been Delivered!

Hi ${data.customerName},

Great news! Your order #${data.orderNumber} has been delivered.

Delivered To:
${data.shippingAddress.fullName}
${data.shippingAddress.address}
${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zipCode}

Your Items:
${data.items.map(item => `- ${item.name}`).join('\n')}

Love your new items? Leave a review: ${reviewUrl}

Something not right? Contact our support team within 30 days for easy returns.

Thank you for being part of the Head Over Feels family!
`

  return {
    subject: `🎉 Your Order #${data.orderNumber} Has Been Delivered!`,
    html,
    text,
  }
}

export function generateRefundEmail(data: RefundEmailData): { subject: string; html: string; text: string } {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Refund Has Been Processed</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">HEAD OVER FEELS</div>
    </div>
    
    <h1>💳 Refund Processed</h1>
    <p>Hi ${data.customerName},</p>
    <p>We've processed your ${data.isPartialRefund ? 'partial ' : ''}refund for order <strong>#${data.orderNumber}</strong>.</p>
    
    <div class="refund-summary">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="color: #6b7280;">Original Order Total:</span>
        <span>$${data.originalTotal.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #bfdbfe;">
        <span style="font-weight: 600; color: #1e40af;">Refund Amount:</span>
        <span style="font-weight: 700; font-size: 20px; color: #1e40af;">$${data.refundAmount.toFixed(2)}</span>
      </div>
    </div>
    
    ${data.refundReason ? `
    <div class="section">
      <div class="section-title">Refund Reason</div>
      <p style="color: #6b7280;">${data.refundReason}</p>
    </div>
    ` : ''}
    
    <div class="highlight">
      <strong>What happens next?</strong>
      <p style="margin: 8px 0 0 0;">Your refund will appear on your original payment method within 5-10 business days, depending on your bank.</p>
    </div>
    
    <div class="footer">
      <p>Questions? <a href="${baseUrl}/contact">Contact our support team</a></p>
      <p>We hope to see you again soon! 💖</p>
    </div>
  </div>
</body>
</html>
`

  const text = `
Refund Processed

Hi ${data.customerName},

We've processed your ${data.isPartialRefund ? 'partial ' : ''}refund for order #${data.orderNumber}.

Original Order Total: $${data.originalTotal.toFixed(2)}
Refund Amount: $${data.refundAmount.toFixed(2)}

${data.refundReason ? `Refund Reason: ${data.refundReason}` : ''}

What happens next?
Your refund will appear on your original payment method within 5-10 business days, depending on your bank.

Questions? Contact our support team at ${baseUrl}/contact

We hope to see you again soon!
`

  return {
    subject: `💳 Refund Processed for Order #${data.orderNumber}`,
    html,
    text,
  }
}

export function generateOutForDeliveryEmail(data: OrderStatusEmailData): { subject: string; html: string; text: string } {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Order Is Out for Delivery!</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">HEAD OVER FEELS</div>
    </div>
    
    <h1>🚚 Out for Delivery!</h1>
    <p>Hi ${data.customerName},</p>
    
    <div class="highlight" style="background-color: #ecfdf5;">
      <strong>Your order #${data.orderNumber} is out for delivery today!</strong>
      <p style="margin: 8px 0 0 0;">Get ready - your package will arrive soon.</p>
    </div>
    
    ${data.trackingNumber ? `
    <div class="tracking-box">
      <div class="section-title">Tracking Number</div>
      <div class="tracking-number">${data.trackingNumber}</div>
      ${data.carrier ? `<div style="color: #6b7280; margin-top: 8px;">via ${data.carrier}</div>` : ''}
      ${data.trackingUrl ? `<a href="${data.trackingUrl}" class="button">Track in Real-Time</a>` : ''}
    </div>
    ` : ''}
    
    <div class="section">
      <div class="section-title">Delivering To</div>
      <div class="address">
        ${data.shippingAddress.fullName}<br>
        ${data.shippingAddress.address}<br>
        ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zipCode}
      </div>
    </div>
    
    <div class="footer">
      <p>Can't be home? Check with your carrier about delivery options.</p>
      <p>Thank you for shopping with Head Over Feels! 💖</p>
    </div>
  </div>
</body>
</html>
`

  const text = `
Out for Delivery!

Hi ${data.customerName},

Your order #${data.orderNumber} is out for delivery today!
Get ready - your package will arrive soon.

${data.trackingNumber ? `
Tracking Number: ${data.trackingNumber}
${data.carrier ? `Carrier: ${data.carrier}` : ''}
${data.trackingUrl ? `Track in real-time: ${data.trackingUrl}` : ''}
` : ''}

Delivering To:
${data.shippingAddress.fullName}
${data.shippingAddress.address}
${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zipCode}

Can't be home? Check with your carrier about delivery options.

Thank you for shopping with Head Over Feels!
`

  return {
    subject: `🚚 Your Order #${data.orderNumber} Is Out for Delivery!`,
    html,
    text,
  }
}
