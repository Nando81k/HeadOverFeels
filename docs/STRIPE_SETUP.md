# Stripe Integration Setup Guide

## Prerequisites
- Stripe account (sign up at https://stripe.com)
- Your application deployed or running locally

## Step 1: Get Your API Keys

1. Go to the [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Copy your **Publishable key** (starts with `pk_test_...`)
3. Copy your **Secret key** (starts with `sk_test_...`)
4. Add them to your `.env.local` file:

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_key_here
```

## Step 2: Set Up Webhook Endpoint

Webhooks allow Stripe to notify your application about payment events.

### For Local Development

1. Install the Stripe CLI:
   ```bash
   brew install stripe/stripe-brew/stripe
   ```

2. Login to Stripe CLI:
   ```bash
   stripe login
   ```

3. Forward webhook events to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. Copy the webhook signing secret (starts with `whsec_...`) and add to `.env.local`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
   ```

### For Production

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-domain.com/api/stripe/webhook`
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.succeeded`
5. Click "Add endpoint"
6. Copy the signing secret and add to your production environment variables

## Step 3: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. In another terminal, start webhook forwarding:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

3. Navigate to the checkout page and complete a test payment

4. Use Stripe's test card numbers:
   - **Success**: `4242 4242 4242 4242`
   - **Decline**: `4000 0000 0000 0002`
   - **3D Secure**: `4000 0025 0000 3155`
   - Use any future expiry date, any 3-digit CVC, and any ZIP code

## Payment Flow

1. **Customer submits shipping info** → Form validation
2. **Create payment intent** → POST to `/api/stripe/payment-intent`
3. **Show payment form** → Stripe Elements for secure card input
4. **Customer confirms payment** → Stripe processes payment
5. **Webhook notification** → `/api/stripe/webhook` receives event
6. **Update order status** → Database updated (to be implemented)
7. **Redirect to confirmation** → `/order/confirmation`

## Security Best Practices

✅ **Do:**
- Always verify webhook signatures
- Use HTTPS in production
- Keep secret keys server-side only
- Validate amounts server-side

❌ **Don't:**
- Never expose secret keys in client code
- Don't trust payment amounts from client
- Don't skip webhook signature verification

## Troubleshooting

### "Invalid API Key"
- Check that you're using test keys in development
- Verify keys don't have extra spaces
- Make sure `STRIPE_SECRET_KEY` doesn't have `NEXT_PUBLIC_` prefix

### "Webhook signature verification failed"
- Ensure webhook secret matches your Stripe CLI or dashboard
- Check that webhook endpoint is publicly accessible
- Verify you're using the raw request body (not parsed JSON)

### "Payment requires authentication"
- This is normal for 3D Secure cards
- Stripe Elements handles this automatically
- Test with `4000 0025 0000 3155` to trigger 3D Secure

## Next Steps

- [ ] Implement order creation in database
- [ ] Add email notifications for order confirmation
- [ ] Create admin order management dashboard
- [ ] Add refund functionality
- [ ] Implement subscription billing (if needed)

## Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Payment Intents API](https://stripe.com/docs/payments/payment-intents)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
- [Testing Guide](https://stripe.com/docs/testing)
