# Pending Payments Issue - Diagnosis & Fix

## Problem
Orders in the database show `paymentStatus: PENDING` even though they may have been paid through Stripe. This happens because:

1. **Stripe webhooks are not being received** - The webhook listener must be running to receive payment events
2. **Orders were created but webhooks never fired** - Historical orders from before webhook setup

## Root Cause
The Stripe webhook endpoint (`/api/stripe/webhook`) only updates payment status when it receives the `payment_intent.succeeded` event from Stripe. If the webhook listener is not running, this event never arrives.

## Webhook Flow (How It Should Work)

```
1. Customer completes checkout → Order created with paymentStatus: PENDING
2. Payment processed by Stripe → Stripe sends payment_intent.succeeded webhook
3. Webhook handler receives event → Updates order to paymentStatus: PAID
4. Order confirmation email sent → Inventory reduced → Loyalty points awarded
```

## Solutions

### Solution 1: Start Webhook Listener (For Future Orders)

**For Local Development:**
```bash
# Terminal 1: Run your Next.js dev server
npm run dev

# Terminal 2: Run Stripe webhook listener
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This will:
- Forward Stripe events to your local server
- Print webhook events in real-time
- Automatically update new orders when payments succeed

**Important:** Keep both terminals running while developing/testing checkout!

### Solution 2: Fix Existing Pending Orders

**Option A: Run the automated script**
```bash
./scripts/fix-pending-payments.sh
```

This script will:
1. Show all orders with PENDING payment status
2. Ask for confirmation
3. Update all PENDING orders to PAID

**Option B: Manual SQL update**
```bash
# Mark all pending orders as paid
sqlite3 prisma/dev.db "UPDATE orders SET paymentStatus = 'PAID' WHERE paymentStatus = 'PENDING';"

# Or update specific orders only
sqlite3 prisma/dev.db "UPDATE orders SET paymentStatus = 'PAID' WHERE orderNumber = 'HOF-1762146835607-4LLL8PA1I';"
```

**Option C: Use Prisma Studio**
```bash
npx prisma studio
# Navigate to Order model
# Filter by paymentStatus = PENDING
# Edit each order and change to PAID
```

## Verification

Check payment status distribution:
```bash
sqlite3 -header -column prisma/dev.db "SELECT paymentStatus, COUNT(*) as count FROM orders GROUP BY paymentStatus;"
```

Check specific order:
```bash
sqlite3 prisma/dev.db "SELECT orderNumber, status, paymentStatus, total, createdAt FROM orders WHERE orderNumber = 'YOUR_ORDER_NUMBER';"
```

## Prevention

### For Local Development:
Always run the webhook listener when testing checkout:
```bash
# Add this to your development workflow
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### For Production:
1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy the webhook signing secret
5. Add to production environment variables:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_your_production_secret
   ```

## Testing Webhooks

Test that webhooks are working:
```bash
# Trigger a test webhook
stripe trigger payment_intent.succeeded

# View webhook logs
stripe logs tail
```

## Current Environment

Check your current setup:
```bash
# Check if webhook secret is set
grep STRIPE_WEBHOOK_SECRET .env.local

# Check if Stripe CLI is logged in
stripe --version

# Check if listener is running
ps aux | grep "stripe listen"
```

## Quick Fix Summary

**For your current situation:**
1. Run `./scripts/fix-pending-payments.sh` to mark old orders as PAID
2. Start webhook listener: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. Test a new order to verify webhook is working

**Note:** The 11 pending orders from the past month are likely test orders or orders created before webhook setup. Marking them as PAID is safe if they're test data or if you've verified they were actually paid in the Stripe dashboard.
