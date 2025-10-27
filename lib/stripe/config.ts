import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey && process.env.NODE_ENV === 'production') {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables')
}

// For build time, use a dummy key if not set
export const stripe = new Stripe(stripeSecretKey || 'sk_test_dummy_key_for_build', {
  apiVersion: '2025-09-30.clover',
  typescript: true,
})
