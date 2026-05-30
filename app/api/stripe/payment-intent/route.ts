import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/config'
import { z } from 'zod'

// Validation schema
const createPaymentIntentSchema = z.object({
  amount: z.number().positive().int(),
  currency: z.string().default('usd'),
  metadata: z.object({
    orderId: z.string().optional(),
    customerId: z.string().optional(),
    items: z.string().optional(), // JSON stringified cart items
  }).optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
})

// POST /api/stripe/payment-intent - Create payment intent
export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY is not configured')
      return NextResponse.json(
        { error: 'Payment processing is not configured. Please contact support.' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { amount, currency, metadata, idempotencyKey: clientIdempotencyKey } = createPaymentIntentSchema.parse(body)

    // Use the client-supplied idempotency key so retries from network flakiness
    // hit Stripe's deduplication layer rather than creating a second PaymentIntent.
    // Fall back to a server-generated key as a back-compat safety net, but log a
    // warning so we can track down any caller that omits the key.
    let idempotencyKey = clientIdempotencyKey
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID()
      console.warn(
        '[payment-intent] No idempotencyKey supplied by client — generated server-side fallback:',
        idempotencyKey,
        '— update the caller to send a stable key per checkout attempt.'
      )
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount, // Amount in cents
        currency,
        metadata: metadata || {},
        automatic_payment_methods: {
          enabled: true,
        },
      },
      { idempotencyKey }
    )

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error) {
    console.error('Stripe payment intent error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    // Check for Stripe-specific errors
    if (error instanceof Error) {
      // Stripe authentication error
      if (error.message.includes('Invalid API Key') || error.message.includes('authentication')) {
        return NextResponse.json(
          { error: 'Payment service configuration error. Please contact support.' },
          { status: 503 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
