# Order Confirmation & Shipment Tracking System

## Overview

This document outlines the complete email confirmation and shipment tracking system for Head Over Feels.

## Features Implemented

### ✅ 1. Order Confirmation Emails

**When**: Automatically sent when customer reaches confirmation page after successful payment

**What's Included**:
- Order number and details
- All purchased items with quantities, sizes, colors
- Complete shipping address
- Price breakdown (subtotal, shipping, tax, total)
- Email confirmation notice
- Order tracking link
- Shipment updates notification

**Technology**: Resend email service with HTML/text templates

### ✅ 2. Shipment Tracking Database

**Fields Added to Order Model**:
- `trackingNumber` - Carrier tracking number
- `trackingUrl` - Direct URL to carrier tracking page
- `carrier` - Shipping carrier (USPS, FedEx, UPS, DHL)
- `shippedAt` - Timestamp when order shipped
- `estimatedDelivery` - Expected delivery date
- `deliveredAt` - Actual delivery timestamp

### ✅ 3. Shipment Notification Emails

**When**: Sent when admin adds tracking information to an order

**What's Included**:
- Order shipped confirmation
- Tracking number (prominently displayed)
- Carrier information
- Estimated delivery date (if available)
- Direct link to carrier tracking page
- Link to internal order tracking page
- All order items
- Shipping address

**Carrier Tracking URLs**:
- USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels={number}`
- FedEx: `https://www.fedex.com/fedextrack/?trknbr={number}`
- UPS: `https://www.ups.com/track?tracknum={number}`
- DHL: `https://www.dhl.com/en/express/tracking.html?AWB={number}`

### ✅ 4. API Endpoints

#### **POST /api/orders/[id]/send-confirmation**
Sends order confirmation email (called automatically from confirmation page)

```typescript
// Automatic - no parameters needed
fetch(`/api/orders/${orderId}/send-confirmation`, {
  method: 'POST',
})
```

#### **GET /api/orders/[id]/tracking**
Fetches tracking information for an order

```typescript
const response = await fetch(`/api/orders/${orderId}/tracking`)
const { data } = await response.json()
// Returns: trackingNumber, carrier, shippedAt, estimatedDelivery, etc.
```

#### **PATCH /api/orders/[id]/tracking**
Updates tracking information (admin only)

```typescript
fetch(`/api/orders/${orderId}/tracking`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    trackingNumber: '1Z999AA10123456784',
    carrier: 'UPS',
    estimatedDelivery: '2025-11-01',
    sendEmail: true  // Send notification to customer
  })
})
```

### 🚧 5. Still To Implement

#### **Order Tracking Page** (`/order/track/[id]`)
Public page where customers can check their order status

**Features Needed**:
- Order status timeline
- Tracking number display
- Carrier information
- Estimated delivery date
- Link to carrier tracking
- Order items summary
- Shipping address

#### **Admin Tracking Management UI**
Interface in admin dashboard to add/update tracking info

**Features Needed**:
- Form to input tracking number and carrier
- Estimated delivery date picker
- Option to send notification email
- Validation for tracking number format
- Preview of notification email

## Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```env
# Resend Email Service
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxx
EMAIL_FROM="Head Over Feels <orders@headoverfeels.com>"
EMAIL_REPLY_TO="support@headoverfeels.com"

# Base URL for links in emails
NEXT_PUBLIC_BASE_URL=https://headoverfeels.com
```

### 2. Get Resend API Key

1. Go to [resend.com](https://resend.com)
2. Sign up for free account (3,000 emails/month free)
3. Verify your domain or use test domain
4. Copy API key to `.env`

### 3. Database Migration

Already applied! The database now includes:
```sql
ALTER TABLE orders ADD COLUMN trackingUrl TEXT;
```

### 4. Test Email Sending

```bash
# In development, emails go to Resend dashboard
# No actual emails sent unless domain is verified

# Test order confirmation
curl -X POST http://localhost:3000/api/orders/ORDER_ID/send-confirmation

# Test tracking update
curl -X PATCH http://localhost:3000/api/orders/ORDER_ID/tracking \
  -H "Content-Type: application/json" \
  -d '{
    "trackingNumber": "1Z999AA10123456784",
    "carrier": "UPS",
    "sendEmail": true
  }'
```

## Email Templates

### Order Confirmation Template

Located: `/lib/email/templates/order-confirmation.ts`

**Features**:
- Responsive HTML design
- Brand-consistent styling
- Item images and details
- Price breakdown table
- Shipping address display
- Call-to-action buttons
- Plain text fallback

### Shipment Notification Template

Located: `/app/api/orders/[id]/tracking/route.ts` (inline HTML)

**Features**:
- Purple gradient header
- Large tracking number display
- Carrier logo/name
- Track package button (links to carrier)
- Estimated delivery date
- Order items list
- Responsive design

## User Flow

### 1. Order Confirmation Flow

```
Customer completes payment
  ↓
Stripe redirects to /order/confirmation?orderId=xxx&success=true
  ↓
Page loads → useEffect triggers
  ↓
Fetch order details
  ↓
Send confirmation email (background)
  ↓
Display confirmation page
  ↓
Customer receives email instantly
```

### 2. Shipment Tracking Flow

```
Admin marks order as shipped
  ↓
Admin inputs tracking number + carrier
  ↓
PATCH /api/orders/[id]/tracking
  ↓
Database updated (status → SHIPPED)
  ↓
Shipment notification email sent
  ↓
Customer receives tracking info email
  ↓
Customer clicks "Track Package" button
  ↓
Opens carrier tracking page OR internal tracking page
```

## Security Considerations

### Email Sending

- ✅ Server-side only (API routes)
- ✅ No sensitive data exposed
- ✅ Rate limiting via Resend (3,000/month free tier)
- ✅ Email failures don't block checkout

### Tracking Updates

- ⚠️ **TODO**: Add admin authentication check
- ⚠️ **TODO**: Validate tracking number format
- ✅ Customer email hidden from API responses
- ✅ Internal notes not included in emails

## Future Enhancements

### Email Features
- [ ] Add email preferences (customer can opt-out of marketing)
- [ ] Add SMS notifications via Twilio
- [ ] Add delivery confirmation email
- [ ] Add review request email (7 days after delivery)
- [ ] Add abandoned cart emails

### Tracking Features
- [ ] Automatic tracking updates via carrier webhooks
- [ ] Real-time tracking status (in transit, out for delivery, etc.)
- [ ] Package location map
- [ ] Delivery photo confirmation
- [ ] Signature requirement tracking

### Admin Features
- [ ] Bulk tracking upload (CSV import)
- [ ] Auto-generate tracking URLs from carrier + number
- [ ] Tracking number validation
- [ ] Email preview before sending
- [ ] Email delivery status tracking

## Troubleshooting

### Email Not Sending

**Issue**: Confirmation email not received

**Solutions**:
1. Check Resend API key is valid
2. Check email address format
3. Check spam folder
4. Verify domain in Resend dashboard
5. Check Resend logs for errors

### Tracking URL Not Working

**Issue**: Carrier tracking link doesn't work

**Solutions**:
1. Verify tracking number format
2. Check carrier is correct
3. Allow 24 hours for carrier to update tracking
4. Manually test carrier URL

### Database Migration Failed

**Issue**: trackingUrl column doesn't exist

**Solutions**:
```bash
# Reset and re-apply migrations
npx prisma migrate reset
npx prisma migrate dev

# Or just add column manually
npx prisma db push
```

## Testing Checklist

### Email Confirmation
- [ ] Place order with test Stripe card
- [ ] Verify redirect to confirmation page
- [ ] Check Resend dashboard for email sent
- [ ] Verify email contains all order details
- [ ] Test "Track Your Order" link works
- [ ] Verify plain text email renders correctly

### Shipment Tracking
- [ ] Add tracking info to test order
- [ ] Verify tracking email sent
- [ ] Click "Track Package" button
- [ ] Verify carrier URL works
- [ ] Check tracking number displays correctly
- [ ] Verify estimated delivery shows if provided

### Admin Workflow
- [ ] Access order in admin
- [ ] Input tracking number
- [ ] Select carrier from dropdown
- [ ] Set estimated delivery date
- [ ] Check "Send email" option
- [ ] Submit form
- [ ] Verify order status updates to SHIPPED
- [ ] Verify customer receives email

## Production Deployment

### Before Launch
1. [ ] Get production Resend API key
2. [ ] Verify email domain in Resend
3. [ ] Update `EMAIL_FROM` to verified domain
4. [ ] Set `NEXT_PUBLIC_BASE_URL` to production URL
5. [ ] Test all email templates in production
6. [ ] Set up email monitoring alerts
7. [ ] Configure email rate limits

### Post-Launch Monitoring
- Monitor Resend dashboard for delivery rates
- Check bounce rates and spam complaints
- Review customer feedback on emails
- Track email open rates (if enabled)
- Monitor API error logs for email failures

## Cost Breakdown

### Resend Pricing
- **Free Tier**: 3,000 emails/month (100/day)
- **Pro**: $20/month for 50,000 emails
- **Business**: $80/month for 300,000 emails

### Expected Usage
- **Confirmation Emails**: 1 per order
- **Shipment Emails**: 1 per order
- **Total**: ~2 emails per order

**Example**: 500 orders/month = 1,000 emails/month (free tier ✅)

## Support

For questions or issues:
- **Email**: support@headoverfeels.com
- **Docs**: This file
- **Resend Docs**: https://resend.com/docs
- **Stripe Webhooks**: https://stripe.com/docs/webhooks

---

**Last Updated**: October 25, 2025
**Status**: 60% Complete (Emails ✅, Tracking API ✅, Tracking Page 🚧, Admin UI 🚧)
