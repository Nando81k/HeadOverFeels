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
    const { amount, currency, metadata } = createPaymentIntentSchema.parse(body)

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount, // Amount in cents
      currency,
      metadata: metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    })

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
