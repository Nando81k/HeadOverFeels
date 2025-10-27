# Quick Start: Email Confirmation & Tracking

## ⚡ 5-Minute Setup

### 1. Get Resend API Key (2 minutes)

1. Go to **[resend.com](https://resend.com)** and sign up
2. Click **"API Keys"** in sidebar
3. Click **"Create API Key"**
4. Name it "Head Over Feels Production"
5. Copy the key (starts with `re_...`)

### 2. Add Environment Variables (1 minute)

Add to your `.env` file:

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM="Head Over Feels <orders@headoverfeels.com>"
EMAIL_REPLY_TO="support@headoverfeels.com"
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Test It Works (2 minutes)

```bash
# Restart dev server
npm run dev

# Place a test order with Stripe test card
# Card: 4242 4242 4242 4242
# Date: Any future date
# CVC: Any 3 digits

# Check your email for order confirmation!
```

## ✅ What You Get Instantly

- ✉️ **Order confirmation emails** - Sent automatically after checkout
- 📦 **Shipment tracking** - Database ready to store tracking info
- 🚚 **Shipping notifications** - API ready to send tracking emails
- 🎨 **Beautiful templates** - Professional HTML emails with branding

## 📧 Email Examples

### Order Confirmation Email

Sent when customer completes checkout:

```
Subject: Order Confirmation - HF-2025-001

✅ Order Confirmed!
Order #HF-2025-001

Thank you for your order!
We've received your order and will send you shipping updates at customer@email.com

ORDER ITEMS
• Classic Hoodie - Size: L • Color: Black • Qty: 1 - $79.99

SHIPPING ADDRESS
John Doe
123 Main St
San Francisco, CA 94102
United States

ORDER SUMMARY
Subtotal: $79.99
Shipping: FREE
Tax: $6.40
Total: $86.39

[Track Your Order] button
```

### Shipment Notification Email

Sent when you add tracking info (via API):

```
Subject: Your Order Has Shipped! 📦 - Order #HF-2025-001

Your order #HF-2025-001 is on its way!

TRACKING NUMBER
1Z999AA10123456784

Carrier: UPS
Estimated Delivery: Friday, November 1

[Track Your Package] button → Links to UPS tracking

YOUR ITEMS
• Classic Hoodie × 1 - $79.99

SHIPPING ADDRESS
John Doe
123 Main St
San Francisco, CA 94102
```

## 🔧 How to Update Tracking (For Admin)

Use the API to add tracking info and send notification:

```javascript
// Example: Add tracking to an order
fetch(`/api/orders/${orderId}/tracking`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    trackingNumber: '1Z999AA10123456784',
    carrier: 'UPS',
    estimatedDelivery: '2025-11-01',
    sendEmail: true  // Customer gets notification!
  })
})
```

**Supported Carriers**: USPS, FedEx, UPS, DHL

## 🧪 Testing Checklist

### Test Order Confirmation
- [ ] Place order with test Stripe card
- [ ] Verify redirect to confirmation page
- [ ] Check email inbox (confirmation should arrive instantly)
- [ ] Verify all order details in email
- [ ] Click "Track Your Order" link (should work)

### Test Shipment Notification
- [ ] Use PATCH API to add tracking to test order
- [ ] Check email inbox (shipment notification should arrive)
- [ ] Verify tracking number displays correctly
- [ ] Click "Track Your Package" button
- [ ] Verify carrier tracking URL works

## 🐛 Troubleshooting

### Email Not Sending?

**Check Resend Dashboard**:
1. Go to [resend.com/logs](https://resend.com/logs)
2. See if email was sent
3. Check for errors

**Common Issues**:
- ❌ API key not set → Add to `.env` and restart server
- ❌ Invalid email address → Check customer email format
- ❌ Domain not verified → Use test email in development
- ❌ Rate limit exceeded → Upgrade Resend plan

### Need Help?

1. Check **EMAIL_TRACKING_COMPLETE.md** for full documentation
2. Check Resend logs at [resend.com/logs](https://resend.com/logs)
3. Check server logs: `npm run dev` output
4. Test with cURL:
   ```bash
   curl -X POST http://localhost:3000/api/orders/ORDER_ID/send-confirmation
   ```

## 📈 Next Steps

Once emails are working:

1. **Add Tracking UI to Confirmation Page** (30 min)
   - Show "Your order has shipped!" if tracking exists
   - Display tracking number and carrier
   - Add "Track Package" button

2. **Build Order Tracking Page** (1 hour)
   - Create `/order/track/[id]` page
   - Show order timeline
   - Display tracking info
   - Link to carrier tracking

3. **Add Admin Tracking UI** (1 hour)
   - Form to input tracking number
   - Carrier dropdown (USPS, FedEx, UPS, DHL)
   - Estimated delivery date picker
   - "Send notification" checkbox

## 💡 Pro Tips

### Development Mode

In development, Resend doesn't send actual emails unless your domain is verified. Emails appear in the **Resend dashboard** only.

To test real emails:
1. Verify your domain in Resend
2. Add DNS records
3. Wait for verification
4. Emails will be sent for real!

### Production Mode

Before deploying:
1. ✅ Get production Resend API key
2. ✅ Verify your domain
3. ✅ Update `EMAIL_FROM` to verified domain
4. ✅ Set `NEXT_PUBLIC_BASE_URL` to production URL
5. ✅ Test with real orders
6. ✅ Monitor Resend dashboard for issues

## 📊 Monitoring

Keep an eye on:
- **Delivery Rate**: Should be >95%
- **Bounce Rate**: Should be <5%
- **Spam Complaints**: Should be 0%
- **API Errors**: Check server logs

**Resend Dashboard**: [resend.com/logs](https://resend.com/logs)

---

That's it! You now have professional order confirmation and shipment tracking emails. 🎉

**Questions?** Check `EMAIL_TRACKING_COMPLETE.md` for detailed documentation.
