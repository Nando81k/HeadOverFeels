interface OrderItem {
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
}

interface Order {
  id: string
  orderNumber: string
  items: OrderItem[]
  subtotal: number
  shipping: number
  tax: number
  total: number
  customerEmail: string
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

export function generateOrderConfirmationEmail(order: Order) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const trackingPageUrl = `${baseUrl}/order/track/${order.id}`
  
  return {
    subject: `Order Confirmation - ${order.orderNumber}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
  <style>
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
    .order-number {
      font-size: 18px;
      color: #6b7280;
      margin-bottom: 24px;
    }
    .section {
      margin-bottom: 32px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .item {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .item-details {
      flex: 1;
    }
    .item-name {
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }
    .item-variant {
      font-size: 14px;
      color: #6b7280;
    }
    .item-price {
      font-weight: 600;
      color: #111827;
      white-space: nowrap;
      margin-left: 16px;
    }
    .address {
      background-color: #f9fafb;
      padding: 16px;
      border-radius: 6px;
      line-height: 1.8;
    }
    .totals {
      border-top: 2px solid #e5e7eb;
      padding-top: 16px;
      margin-top: 16px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
    }
    .total-row.grand-total {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      border-top: 2px solid #111827;
      padding-top: 16px;
      margin-top: 8px;
    }
    .button {
      display: inline-block;
      background-color: #111827;
      color: #ffffff;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 24px 0;
      text-align: center;
    }
    .button:hover {
      background-color: #1f2937;
    }
    .info-box {
      background-color: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .footer {
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }
    .footer a {
      color: #111827;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">HEAD OVER FEELS</div>
    </div>

    <h1>✅ Order Confirmed!</h1>
    <div class="order-number">Order #${order.orderNumber}</div>

    <div class="info-box">
      <strong>📧 Thank you for your order!</strong><br>
      We've received your order and will send you shipping updates at <strong>${order.customerEmail}</strong>
    </div>

    <!-- Order Items -->
    <div class="section">
      <div class="section-title">Order Items</div>
      ${order.items.map(item => `
        <div class="item">
          <div class="item-details">
            <div class="item-name">${item.product.name}</div>
            <div class="item-variant">
              ${item.variant.size ? `Size: ${item.variant.size}` : ''}
              ${item.variant.size && item.variant.color ? ' • ' : ''}
              ${item.variant.color ? `Color: ${item.variant.color}` : ''}
              ${item.variant.size || item.variant.color ? ' • ' : ''}
              Qty: ${item.quantity}
            </div>
          </div>
          <div class="item-price">$${(item.price * item.quantity).toFixed(2)}</div>
        </div>
      `).join('')}
    </div>

    <!-- Shipping Address -->
    <div class="section">
      <div class="section-title">Shipping Address</div>
      <div class="address">
        <strong>${order.shippingAddress.fullName}</strong><br>
        ${order.shippingAddress.address}<br>
        ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}<br>
        ${order.shippingAddress.country}
      </div>
    </div>

    <!-- Order Totals -->
    <div class="section">
      <div class="section-title">Order Summary</div>
      <div class="totals">
        <div class="total-row">
          <span>Subtotal</span>
          <span>$${order.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Shipping</span>
          <span>${order.shipping === 0 ? 'FREE' : `$${order.shipping.toFixed(2)}`}</span>
        </div>
        <div class="total-row">
          <span>Tax</span>
          <span>$${order.tax.toFixed(2)}</span>
        </div>
        <div class="total-row grand-total">
          <span>Total</span>
          <span>$${order.total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    ${order.trackingNumber ? `
    <!-- Tracking Info -->
    <div class="section">
      <div class="section-title">📦 Tracking Information</div>
      <div class="info-box" style="background-color: #eff6ff; border-left-color: #3b82f6;">
        <strong>Your order has shipped!</strong><br>
        Carrier: ${order.carrier}<br>
        Tracking Number: <strong>${order.trackingNumber}</strong><br><br>
        <a href="${order.trackingUrl || trackingPageUrl}" class="button" style="display: inline-block;">Track Your Order</a>
      </div>
    </div>
    ` : `
    <!-- Track Order CTA -->
    <div style="text-align: center;">
      <a href="${trackingPageUrl}" class="button">Track Your Order</a>
      <p style="color: #6b7280; font-size: 14px;">You can check your order status anytime using this link</p>
    </div>
    `}

    <!-- What's Next -->
    <div class="section">
      <div class="section-title">What's Next?</div>
      <p style="color: #6b7280;">
        ${order.trackingNumber 
          ? '✅ Your order has been shipped and is on its way! You can track your package using the link above.'
          : '📦 We\'re processing your order and will send you tracking information as soon as it ships (usually within 1-2 business days).'
        }
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>Need help? Contact us at <a href="mailto:support@headoverfeels.com">support@headoverfeels.com</a></p>
      <p style="margin-top: 16px;">
        <a href="${baseUrl}">Visit Our Store</a> • 
        <a href="${baseUrl}/order/track/${order.id}">Track Order</a>
      </p>
      <p style="margin-top: 16px; font-size: 12px; color: #9ca3af;">
        © ${new Date().getFullYear()} Head Over Feels. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
ORDER CONFIRMATION - ${order.orderNumber}

Thank you for your order!

Order Number: ${order.orderNumber}
Order Date: ${new Date(order.createdAt).toLocaleDateString()}

ORDER ITEMS:
${order.items.map(item => 
  `${item.product.name}
   ${item.variant.size ? `Size: ${item.variant.size}` : ''} ${item.variant.color ? `Color: ${item.variant.color}` : ''}
   Quantity: ${item.quantity}
   Price: $${(item.price * item.quantity).toFixed(2)}`
).join('\n\n')}

SHIPPING ADDRESS:
${order.shippingAddress.fullName}
${order.shippingAddress.address}
${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}
${order.shippingAddress.country}

ORDER SUMMARY:
Subtotal: $${order.subtotal.toFixed(2)}
Shipping: ${order.shipping === 0 ? 'FREE' : `$${order.shipping.toFixed(2)}`}
Tax: $${order.tax.toFixed(2)}
Total: $${order.total.toFixed(2)}

${order.trackingNumber 
  ? `TRACKING INFORMATION:\nCarrier: ${order.carrier}\nTracking Number: ${order.trackingNumber}\nTrack your order: ${order.trackingUrl || trackingPageUrl}`
  : `Track your order: ${trackingPageUrl}`
}

Need help? Contact us at support@headoverfeels.com

© ${new Date().getFullYear()} Head Over Feels. All rights reserved.
    `.trim(),
  }
}
