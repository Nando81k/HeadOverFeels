import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { stripe } from '@/lib/stripe/config'
import { computeOrderPricing } from '@/lib/checkout/server-pricing'
import { auth } from '@/lib/auth/auth'

const ExpressOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    productVariantId: z.string().optional(),
    quantity: z.number().int().positive(),
  })).min(1),
  payerEmail: z.string().email().optional(),
  payerName: z.string().optional(),
  shippingAddress: z.object({
    addressLine: z.array(z.string()).optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    recipient: z.string().optional(),
  }).optional(),
  shippingOptionId: z.string().default('STANDARD'),
  sessionId: z.string().optional(),
})

// POST /api/orders/express - Create order from Apple Pay / Google Pay
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = ExpressOrderSchema.parse(body)

    const session = await auth()
    const authenticatedCustomerId = session?.user?.id ?? null

    const email = data.payerEmail?.toLowerCase().trim()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Parse name — "First Last" → firstName / lastName
    const nameParts = (data.payerName ?? '').trim().split(/\s+/)
    const firstName = nameParts[0] || 'Guest'
    const lastName = nameParts.slice(1).join(' ') || '-'

    // Build address fields from Stripe PaymentRequest shape
    const addr = data.shippingAddress
    const addressLine = addr?.addressLine ?? []
    const address1 = addressLine[0] || ''
    const address2 = addressLine[1] || undefined
    const city = addr?.city || ''
    const state = addr?.region || ''
    const postalCode = addr?.postalCode || ''
    const country = addr?.country || 'US'

    const shippingMethod = (data.shippingOptionId.toUpperCase() || 'STANDARD') as 'STANDARD' | 'EXPRESS' | 'OVERNIGHT'

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create customer
      let customer = null as Awaited<ReturnType<typeof tx.customer.findUnique>>

      if (authenticatedCustomerId) {
        customer = await tx.customer.findUnique({ where: { id: authenticatedCustomerId } })
      }

      if (!customer) {
        customer = await tx.customer.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          orderBy: [{ totalOrders: 'desc' }, { createdAt: 'asc' }],
        })
      }

      if (!customer) {
        customer = await tx.customer.create({ data: { email } })
      }

      // 2. Create addresses
      const shippingAddress = await tx.address.create({
        data: {
          firstName,
          lastName,
          address1,
          address2,
          city,
          state,
          postalCode,
          country,
          customerId: customer.id,
          type: 'SHIPPING',
        },
      })

      const billingAddress = await tx.address.create({
        data: {
          firstName,
          lastName,
          address1,
          address2,
          city,
          state,
          postalCode,
          country,
          customerId: customer.id,
          type: 'BILLING',
        },
      })

      // 3. Compute authoritative pricing
      const pricing = await computeOrderPricing(tx, {
        items: data.items.map((item) => ({
          productId: item.productId,
          productVariantId: item.productVariantId,
          quantity: item.quantity,
        })),
        shippingMethod,
        customerId: customer.id,
      })

      // 4. Validate inventory
      for (const item of data.items) {
        if (!item.productVariantId) continue
        const variant = await tx.productVariant.findUnique({
          where: { id: item.productVariantId },
          select: { inventory: true, size: true, color: true },
        })
        if (!variant || variant.inventory < item.quantity) {
          throw new Error(`Insufficient inventory for a selected item. Please refresh and try again.`)
        }
      }

      // 5. Fetch product names for order items
      const enrichedItems = await Promise.all(
        data.items.map(async (item) => {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { name: true, images: true, price: true },
          })
          if (!product) throw new Error(`Product ${item.productId} not found`)

          const cleanVariantId = item.productVariantId?.trim() || undefined
          const variant = cleanVariantId
            ? await tx.productVariant.findUnique({
                where: { id: cleanVariantId },
                select: { size: true, color: true, sku: true, price: true },
              })
            : null

          const unitPrice = variant?.price ?? product.price

          let imageUrl: string | null = null
          try {
            const parsedImages = JSON.parse(product.images as string)
            if (Array.isArray(parsedImages) && parsedImages.length > 0) {
              imageUrl = parsedImages[0]?.url || null
            }
          } catch { /* ignore */ }

          return {
            productId: item.productId,
            productVariantId: cleanVariantId || null,
            quantity: item.quantity,
            price: unitPrice,
            productName: product.name,
            productImage: imageUrl,
            variantDetails: variant
              ? JSON.stringify({ size: variant.size, color: variant.color, sku: variant.sku })
              : null,
          }
        })
      )

      // 6. Create order
      const orderNumber = `HOF-${nanoid(12).toUpperCase()}`
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerEmail: email,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          shipping: pricing.shipping,
          tax: pricing.tax,
          total: pricing.total,
          shippingMethod,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod: 'stripe',
          items: { create: enrichedItems },
        },
      })

      // 7. Decrement inventory
      for (const item of data.items) {
        if (!item.productVariantId) continue
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { inventory: { decrement: item.quantity } },
        })
      }

      // 8. Release cart reservations
      if (data.sessionId) {
        await tx.cartReservation.updateMany({
          where: { sessionId: data.sessionId, isActive: true },
          data: { isActive: false },
        })
      }

      return { order, pricing }
    })

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(result.pricing.total * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { orderId: result.order.id, customerEmail: email },
    })

    return NextResponse.json({
      orderId: result.order.id,
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error) {
    console.error('Express order error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create order' },
      { status: 500 }
    )
  }
}
