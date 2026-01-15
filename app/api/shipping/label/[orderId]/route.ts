/**
 * Return Shipping Label API
 * 
 * Generates a printable return label PDF for customers
 * Used in demo mode when EasyPost is not configured
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const searchParams = request.nextUrl.searchParams
    const labelData = searchParams.get('data')
    const error = searchParams.get('error')

    // Handle error cases
    if (error === 'generation_failed') {
      return new NextResponse(
        generateErrorHTML('Unable to generate return label. Please contact support.'),
        {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        }
      )
    }

    // Get order details for the label
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shippingAddress: true,
      },
    })

    if (!order) {
      return new NextResponse(
        generateErrorHTML('Order not found'),
        {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        }
      )
    }

    // Parse label data if provided
    let parsedLabelData = null
    if (labelData) {
      try {
        parsedLabelData = JSON.parse(Buffer.from(labelData, 'base64').toString())
      } catch {
        // Ignore parse errors, generate fresh data
      }
    }

    // Generate tracking number if not in data
    const trackingNumber = parsedLabelData?.tracking || `RET${Date.now().toString(36).toUpperCase()}`

    // Generate HTML label (styled for printing)
    const labelHTML = generateLabelHTML({
      orderId,
      orderNumber: order.orderNumber,
      trackingNumber,
      fromAddress: order.shippingAddress ? {
        name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
        company: order.shippingAddress.company,
        street1: order.shippingAddress.address1,
        street2: order.shippingAddress.address2,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zip: order.shippingAddress.postalCode,
        country: order.shippingAddress.country,
      } : null,
      toAddress: {
        name: 'Head Over Feels Returns',
        company: 'Head Over Feels LLC',
        street1: process.env.STORE_ADDRESS_STREET || '123 Fashion Ave',
        street2: process.env.STORE_ADDRESS_STREET2 || 'Suite 100',
        city: process.env.STORE_ADDRESS_CITY || 'Los Angeles',
        state: process.env.STORE_ADDRESS_STATE || 'CA',
        zip: process.env.STORE_ADDRESS_ZIP || '90001',
        country: 'US',
      },
      carrier: 'USPS',
      service: 'Priority Mail',
    })

    return new NextResponse(labelHTML, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="return-label-${order.orderNumber}.html"`,
      },
    })
  } catch (error) {
    console.error('[Label API] Error:', error)
    return new NextResponse(
      generateErrorHTML('An error occurred generating the label'),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  }
}

interface LabelData {
  orderId: string
  orderNumber: string
  trackingNumber: string
  fromAddress: {
    name: string
    company?: string | null
    street1: string
    street2?: string | null
    city: string
    state: string
    zip: string
    country: string
  } | null
  toAddress: {
    name: string
    company?: string | null
    street1: string
    street2?: string | null
    city: string
    state: string
    zip: string
    country: string
  }
  carrier: string
  service: string
}

function generateLabelHTML(data: LabelData): string {
  const { orderNumber, trackingNumber, fromAddress, toAddress, carrier, service } = data

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Return Label - ${orderNumber}</title>
  <style>
    @page {
      size: 4in 6in;
      margin: 0;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      width: 4in;
      height: 6in;
      padding: 0.25in;
      background: white;
    }
    
    .label-container {
      width: 100%;
      height: 100%;
      border: 2px solid #000;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      background: #000;
      color: white;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .header .carrier {
      font-size: 18px;
      font-weight: bold;
    }
    
    .header .service {
      font-size: 12px;
    }
    
    .return-badge {
      background: #FF3131;
      color: white;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    .addresses {
      padding: 12px;
      flex: 1;
    }
    
    .address-block {
      margin-bottom: 16px;
    }
    
    .address-label {
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    
    .address-content {
      font-size: 12px;
      line-height: 1.4;
    }
    
    .address-content .name {
      font-weight: bold;
      font-size: 14px;
    }
    
    .to-address {
      border: 2px solid #000;
      padding: 12px;
      background: #f9f9f9;
    }
    
    .to-address .address-content {
      font-size: 14px;
    }
    
    .to-address .address-content .name {
      font-size: 16px;
    }
    
    .barcode-section {
      padding: 12px;
      text-align: center;
      border-top: 1px dashed #ccc;
    }
    
    .tracking-number {
      font-family: monospace;
      font-size: 16px;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }
    
    .barcode {
      font-family: 'Libre Barcode 39', monospace;
      font-size: 48px;
      letter-spacing: 0;
    }
    
    /* Print barcode as text fallback */
    .barcode-visual {
      height: 48px;
      background: repeating-linear-gradient(
        90deg,
        #000 0px,
        #000 2px,
        #fff 2px,
        #fff 4px,
        #000 4px,
        #000 5px,
        #fff 5px,
        #fff 8px,
        #000 8px,
        #000 10px,
        #fff 10px,
        #fff 11px
      );
      margin: 8px auto;
      width: 80%;
    }
    
    .footer {
      background: #f0f0f0;
      padding: 8px 12px;
      font-size: 9px;
      color: #666;
      text-align: center;
      border-top: 1px solid #ddd;
    }
    
    .print-instructions {
      margin-top: 24px;
      padding: 16px;
      background: #fffde7;
      border: 1px solid #ffc107;
      border-radius: 8px;
    }
    
    .print-instructions h3 {
      color: #f57c00;
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .print-instructions ol {
      margin-left: 20px;
      font-size: 12px;
      line-height: 1.6;
    }
    
    .print-button {
      display: block;
      width: 100%;
      padding: 12px;
      background: #FF3131;
      color: white;
      border: none;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      margin-top: 16px;
      border-radius: 4px;
    }
    
    .print-button:hover {
      background: #E02828;
    }
    
    @media print {
      .print-instructions,
      .print-button {
        display: none !important;
      }
      
      body {
        width: 4in;
        height: 6in;
      }
    }
    
    @media screen {
      body {
        width: auto;
        height: auto;
        max-width: 600px;
        margin: 20px auto;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="label-container">
    <div class="header">
      <div>
        <div class="carrier">${carrier}</div>
        <div class="service">${service}</div>
      </div>
      <div class="return-badge">RETURN LABEL</div>
    </div>
    
    <div class="addresses">
      ${fromAddress ? `
      <div class="address-block">
        <div class="address-label">From:</div>
        <div class="address-content">
          <div class="name">${fromAddress.name}</div>
          ${fromAddress.company ? `<div>${fromAddress.company}</div>` : ''}
          <div>${fromAddress.street1}</div>
          ${fromAddress.street2 ? `<div>${fromAddress.street2}</div>` : ''}
          <div>${fromAddress.city}, ${fromAddress.state} ${fromAddress.zip}</div>
          <div>${fromAddress.country}</div>
        </div>
      </div>
      ` : ''}
      
      <div class="address-block to-address">
        <div class="address-label">Ship To:</div>
        <div class="address-content">
          <div class="name">${toAddress.name}</div>
          ${toAddress.company ? `<div>${toAddress.company}</div>` : ''}
          <div>${toAddress.street1}</div>
          ${toAddress.street2 ? `<div>${toAddress.street2}</div>` : ''}
          <div>${toAddress.city}, ${toAddress.state} ${toAddress.zip}</div>
          <div>${toAddress.country}</div>
        </div>
      </div>
    </div>
    
    <div class="barcode-section">
      <div class="tracking-number">${trackingNumber}</div>
      <div class="barcode-visual"></div>
      <div style="font-size: 10px; color: #666;">Scan for tracking</div>
    </div>
    
    <div class="footer">
      Order: ${orderNumber} | Generated: ${new Date().toLocaleDateString()} | headoverfeels.com
    </div>
  </div>
  
  <div class="print-instructions">
    <h3>📦 How to Use This Label</h3>
    <ol>
      <li>Click the "Print Label" button below</li>
      <li>Print on standard paper (no special label paper required)</li>
      <li>Cut out the label along the border</li>
      <li>Tape securely to your package</li>
      <li>Drop off at any ${carrier} location</li>
    </ol>
    <button class="print-button" onclick="window.print()">🖨️ Print Label</button>
  </div>
</body>
</html>`
}

function generateErrorHTML(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Label Error</title>
  <style>
    body {
      font-family: -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #f5f5f5;
      margin: 0;
    }
    .error-box {
      background: white;
      padding: 32px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
    }
    .error-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    h1 {
      color: #333;
      font-size: 20px;
      margin-bottom: 8px;
    }
    p {
      color: #666;
      margin-bottom: 24px;
    }
    a {
      color: #FF3131;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="error-box">
    <div class="error-icon">⚠️</div>
    <h1>Label Generation Error</h1>
    <p>${message}</p>
    <a href="/contact">Contact Support</a>
  </div>
</body>
</html>`
}
