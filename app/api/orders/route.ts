import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe/config'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { nanoid } from 'nanoid'
import { isValidGuestEmail } from '@/lib/security/guest-session'
import { getPaginationParams, createPaginatedResponse } from '@/lib/validation/schemas'
import { auth } from '@/lib/auth/auth'
import { subscribeToNewsletter } from '@/lib/newsletter/subscribers'
import {
  parseStatuses,
  parsePaymentStatus,
  parsePositiveNumber,
  parseDateValue,
  parseSort,
} from '@/lib/orders/admin-order-query'
import { computeOrderPricing } from '@/lib/checkout/server-pricing'

// Validation schemas
const AddressSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  company: z.string().optional(),
  address1: z.string().min(1, 'Address is required'),
  address2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().default('US'),
})

const OrderItemSchema = z.object({
  productId: z.string(),
  productVariantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive').optional(), // ignored — server uses DB price
})

const CreateOrderSchema = z.object({
  customerEmail: z.string().email('Invalid email'),
  customerPhone: z.string().optional(),
  newsletterOptIn: z.boolean().optional(),
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema,
  items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
  shippingMethod: z.string().optional(), // STANDARD, EXPRESS, OVERNIGHT — server computes pricing
  // Wave 3A: paymentIntentId is no longer accepted from the client — the PI is
  // created atomically server-side. Field kept in schema as ignored for back-compat.
  paymentIntentId: z.string().optional(),
  // Wave 2 #15 idempotency key: client generates a UUID per checkout attempt.
  // Reused on every retry so Stripe deduplicates duplicate PI creation requests.
  piIdempotencyKey: z.string().min(1).max(200).optional(),
  sessionId: z.string().optional(),
  couponCode: z.string().optional(),
  redemptionId: z.string().optional(),
  promotionId: z.string().optional(),
})

const CANONICAL_CUSTOMER_ORDER = [
  { totalOrders: 'desc' as const },
  { lifetimePoints: 'desc' as const },
  { currentPoints: 'desc' as const },
  { createdAt: 'asc' as const },
]

// POST /api/orders - Create a new order
// For guest checkouts: validates guest email against x-guest-email header
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CreateOrderSchema.parse(body)
    const normalizedEmail = validatedData.customerEmail.toLowerCase().trim()
    const session = await auth()
    const authenticatedCustomerId =
      session?.user?.id || request.cookies.get('auth_session')?.value || null

    // Validate guest email if provided
    const headerEmail = request.headers.get('x-guest-email')
    if (headerEmail) {
      const bodyEmail = normalizedEmail
      const cleanHeaderEmail = headerEmail.toLowerCase().trim()

      // For guests: email in request must match header to prevent manipulation
      if (cleanHeaderEmail !== bodyEmail) {
        return NextResponse.json(
          { error: 'Email validation failed' },
          { status: 400 }
        )
      }

      // Validate email format
      if (!isValidGuestEmail(bodyEmail)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        )
      }
    }

    // Wave 3A — Atomic endpoint: Stripe PaymentIntent + Order DB row are created
    // in a single prisma.$transaction (Option B from the audit synthesis).
    //
    // Order of operations inside the transaction:
    //   1. Resolve/create customer
    //   2. Persist addresses
    //   3. Fetch products & compute authoritative server-side pricing
    //   4. Atomically decrement inventory
    //   5. CREATE the Stripe PaymentIntent (external call, inside the tx)
    //   6. Create the Order row with stripePaymentIntentId already set
    //   7. Release cart reservations, update promotion usage
    //
    // Split-brain trade-off (documented per spec):
    //   Stripe is not transactional with the DB. If the DB commit fails AFTER
    //   the PI is created, the PI would become orphaned. To mitigate this, the
    //   PI is created FIRST (step 5), then the DB writes follow. If any DB write
    //   throws, the transaction rolls back and the catch block CANCELS the PI via
    //   stripe.paymentIntents.cancel(). This is the best achievable guarantee
    //   short of a saga/outbox pattern (deferred to a future wave).
    let orphanPiId: string | null = null

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create or find customer
      let customer = null as Awaited<ReturnType<typeof tx.customer.findFirst>>

      if (authenticatedCustomerId) {
        const authenticatedCustomer = await tx.customer.findUnique({
          where: { id: authenticatedCustomerId },
        })

        // Always attach authenticated checkouts to the signed-in customer account.
        // Checkout email can still differ (for receipts), but loyalty/order history
        // must stay tied to the active account to avoid split points.
        if (authenticatedCustomer) {
          customer = authenticatedCustomer
        }
      }

      if (!customer) {
        customer = await tx.customer.findFirst({
          where: {
            email: {
              equals: normalizedEmail,
              mode: 'insensitive',
            },
          },
          orderBy: CANONICAL_CUSTOMER_ORDER,
        })
      }

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            email: normalizedEmail,
            phone: validatedData.customerPhone,
          },
        })
      }

      // 2. Create shipping address
      const shippingAddress = await tx.address.create({
        data: {
          ...validatedData.shippingAddress,
          customerId: customer.id,
          type: 'SHIPPING',
        },
      })

      // 3. Create billing address (or use same as shipping)
      const billingAddress = await tx.address.create({
        data: {
          ...validatedData.billingAddress,
          customerId: customer.id,
          type: 'BILLING',
        },
      })

      // 4. Generate unique order number
      const orderNumber = `HOF-${nanoid(12).toUpperCase()}`

      // 5. Fetch product details for order items (prices from DB — not trusted from client)
      const enrichedItems = await Promise.all(
        validatedData.items.map(async (item) => {
          const cleanVariantId =
            item.productVariantId && item.productVariantId.trim() !== ''
              ? item.productVariantId
              : undefined

          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { name: true, images: true, price: true },
          })

          if (!product) {
            throw new Error(`Product ${item.productId} not found`)
          }

          const variant = cleanVariantId
            ? await tx.productVariant.findUnique({
                where: { id: cleanVariantId },
                select: { size: true, color: true, sku: true, price: true },
              })
            : null

          // Authoritative unit price: variant price if present, else product base price
          const unitPrice = variant?.price ?? product.price

          // Parse images and extract URL from the first image object
          let imageUrl: string | null = null
          if (product.images) {
            try {
              const parsedImages = JSON.parse(product.images as string)
              if (Array.isArray(parsedImages) && parsedImages.length > 0) {
                imageUrl = parsedImages[0]?.url || null
              }
            } catch {
              // ignore malformed images JSON
            }
          }

          return {
            productId: item.productId,
            productVariantId: cleanVariantId,
            quantity: item.quantity,
            price: unitPrice,
            productName: product.name,
            productImage: imageUrl,
            variantDetails: variant
              ? JSON.stringify({
                  size: variant.size,
                  color: variant.color,
                  sku: variant.sku,
                })
              : null,
          }
        })
      )

      // 5b. Compute authoritative pricing server-side
      const pricing = await computeOrderPricing(tx, {
        items: validatedData.items.map((item) => ({
          productId: item.productId,
          productVariantId: item.productVariantId && item.productVariantId.trim() !== ''
            ? item.productVariantId
            : undefined,
          quantity: item.quantity,
        })),
        shippingMethod: validatedData.shippingMethod,
        redemptionId: validatedData.redemptionId,
        promotionId: validatedData.promotionId,
        customerId: customer.id,
      })

      // 5c. Validate that all products/variants exist and atomically decrement inventory
      for (const item of enrichedItems) {
        const productExists = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true },
        })
        if (!productExists) {
          throw new Error(`Product ${item.productId} does not exist. Please refresh your cart and try again.`)
        }

        if (item.productVariantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.productVariantId },
            select: { id: true, size: true, color: true },
          })
          if (!variant) {
            throw new Error(`The selected variant for "${productExists.name}" is no longer available. Please remove it from your cart and add it again with an available size/color.`)
          }
          // Atomic check-and-decrement: only decrements if inventory >= quantity.
          // If another concurrent order claimed the last unit first, count will be 0
          // and the transaction rolls back cleanly — no oversell possible.
          const decrementResult = await tx.productVariant.updateMany({
            where: {
              id: item.productVariantId,
              inventory: { gte: item.quantity },
            },
            data: {
              inventory: { decrement: item.quantity },
            },
          })
          if (decrementResult.count === 0) {
            throw new Error(`Insufficient inventory for variant ${item.productVariantId}`)
          }
        }
      }

      // 5. Create Stripe PaymentIntent BEFORE DB writes so that if the DB
      //    commit fails we can cancel the PI in the catch block below.
      //    The idempotency key from the client (Wave 2 #15) is forwarded so that
      //    Stripe deduplicates retries from network flakiness.
      let pi: import('stripe').default.PaymentIntent
      try {
        const idempotencyKey = validatedData.piIdempotencyKey ?? crypto.randomUUID()
        if (!validatedData.piIdempotencyKey) {
          console.warn(
            '[orders] No piIdempotencyKey supplied by client — generated server-side fallback:',
            idempotencyKey,
            '— update the caller to send a stable key per checkout attempt.'
          )
        }
        pi = await stripe.paymentIntents.create(
          {
            amount: Math.round(pricing.total * 100), // cents, authoritative server total
            currency: 'usd',
            metadata: {
              orderId: orderNumber, // order number at PI-create time; updated to real ID below
              customerEmail: normalizedEmail,
            },
            automatic_payment_methods: { enabled: true },
          },
          { idempotencyKey }
        )
        // Track the PI id so the catch block can cancel it if DB writes fail.
        orphanPiId = pi.id
      } catch (stripeErr) {
        // Stripe itself failed — bubble up so the transaction aborts cleanly.
        throw stripeErr
      }

      // 6. Create order row — PI already exists so we can stamp stripePaymentIntentId
      //    immediately. The webhook's payment_intent.succeeded handler will find
      //    this row by orderId from PI metadata and mark it PAID.
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerEmail: normalizedEmail,
          customerPhone: validatedData.customerPhone,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          shipping: pricing.shipping,
          tax: pricing.tax,
          total: pricing.total,
          shippingMethod: validatedData.shippingMethod || null,
          couponCode: validatedData.couponCode || null,
          redemptionId: validatedData.redemptionId || null,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod: 'stripe',
          stripePaymentIntentId: pi.id,
          items: {
            create: enrichedItems.map((item) => ({
              productId: item.productId,
              productVariantId: item.productVariantId || null,
              quantity: item.quantity,
              price: item.price,
              productName: item.productName,
              productImage: item.productImage,
              variantDetails: item.variantDetails,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
              productVariant: true,
            },
          },
          shippingAddress: true,
          billingAddress: true,
          customer: true,
        },
      })

      // 6b. Update PI metadata with the real DB order ID now that the row exists.
      //     Best-effort — a failure here is non-fatal; the webhook can still find
      //     the order via stripePaymentIntentId stored on the order row.
      try {
        await stripe.paymentIntents.update(pi.id, {
          metadata: { orderId: order.id, customerEmail: normalizedEmail },
        })
      } catch (metaErr) {
        console.warn('[orders] Could not update PI metadata with real orderId:', metaErr)
      }

      // 7. (Inventory already decremented atomically in step 5c above)

      // 8. Release cart reservations if sessionId provided
      if (validatedData.sessionId) {
        await tx.cartReservation.updateMany({
          where: {
            sessionId: validatedData.sessionId,
            isActive: true,
          },
          data: {
            isActive: false,
          },
        })
      }

      // 9. Update promotion usage tracking if promotionId provided
      if (validatedData.promotionId) {
        // Check if promotion exists before updating
        const promotion = await tx.promotion.findUnique({
          where: { id: validatedData.promotionId },
        })
        if (promotion) {
          await tx.promotion.update({
            where: { id: validatedData.promotionId },
            data: {
              usedCount: { increment: 1 },
              totalDiscountGiven: { increment: pricing.discount },
            },
          })
        }
      }

      return { order, pi }
    }).catch(async (txError) => {
      // Orphan-PI cleanup: if the PI was created successfully but the DB commit
      // failed (split-brain), cancel the PI so Stripe doesn't hold open a
      // pending charge. This is the best-effort mitigation for Wave 3A.
      if (orphanPiId) {
        try {
          await stripe.paymentIntents.cancel(orphanPiId)
          console.warn('[orders] Orphan PI canceled after transaction failure:', orphanPiId)
        } catch (cancelErr) {
          // Log but don't mask the original transaction error.
          console.error('[orders] Failed to cancel orphan PI:', orphanPiId, cancelErr)
        }
        orphanPiId = null
      }
      throw txError
    })

    if (validatedData.newsletterOptIn) {
      try {
        await subscribeToNewsletter({
          email: normalizedEmail,
          source: 'checkout',
          sourceDetails: 'checkout_newsletter_opt_in',
        })
      } catch (newsletterError) {
        // Do not fail order creation when newsletter opt-in fails.
        console.error('Checkout newsletter opt-in failed:', newsletterError)
      }
    }

    // Wave 3A response: return both the orderId and the PI client secret so the
    // client can initialize Stripe Elements in a single round trip.
    return NextResponse.json({
      success: true,
      order: result.order,
      orderId: result.order.id,
      paymentIntentClientSecret: result.pi.client_secret,
    })
  } catch (error) {
    console.error('Order creation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create order',
      },
      { status: 500 }
    )
  }
}

// GET /api/orders - List orders (filtered by user or all for admin)
export async function GET(request: NextRequest) {
  try {
    // Get user from session/auth
    const userEmail = request.headers.get('x-user-email') // We'll need to pass this from the client
    const isAdmin = request.headers.get('x-user-admin') === 'true'
    
    // Validate pagination parameters
    const { searchParams } = new URL(request.url)
    const { page, limit } = getPaginationParams(new URL(request.url).searchParams)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const statuses = parseStatuses(searchParams.get('statuses'), status)
    const paymentStatus = parsePaymentStatus(searchParams.get('paymentStatus'))
    const minTotal = parsePositiveNumber(searchParams.get('minTotal'))
    const maxTotal = parsePositiveNumber(searchParams.get('maxTotal'))
    const dateFrom = parseDateValue(searchParams.get('dateFrom'))
    const dateTo = parseDateValue(searchParams.get('dateTo'))
    const { sortBy, sortDir } = parseSort(
      searchParams.get('sortBy'),
      searchParams.get('sortDir')
    )

    const where: Prisma.OrderWhereInput = {}
    
    // If not admin, filter by user's email
    if (!isAdmin && userEmail) {
      where.customerEmail = userEmail
    }
    
    // Admin filtering
    if (isAdmin && statuses.length > 0) {
      where.status = { in: statuses }
    } else if (!isAdmin && status) {
      where.status = status as Prisma.EnumOrderStatusFilter
    }

    if (isAdmin && paymentStatus) {
      where.paymentStatus = paymentStatus
    }

    if (isAdmin && (typeof minTotal === 'number' || typeof maxTotal === 'number')) {
      where.total = {
        ...(typeof minTotal === 'number' ? { gte: minTotal } : {}),
        ...(typeof maxTotal === 'number' ? { lte: maxTotal } : {}),
      }
    }

    if (isAdmin && (dateFrom || dateTo)) {
      where.createdAt = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      }
    }
    
    // Admin can search by email, order number, or customer name
    if (search && isAdmin) {
      const cleanSearch = search.substring(0, 255).trim()
      where.OR = [
        { orderNumber: { contains: cleanSearch, mode: 'insensitive' } },
        { customerEmail: { contains: cleanSearch, mode: 'insensitive' } },
        { 
          shippingAddress: { 
            OR: [
              { firstName: { contains: cleanSearch, mode: 'insensitive' } },
              { lastName: { contains: cleanSearch, mode: 'insensitive' } },
            ]
          } 
        },
        {
          customer: {
            OR: [
              { name: { contains: cleanSearch, mode: 'insensitive' } },
              { email: { contains: cleanSearch, mode: 'insensitive' } },
            ]
          }
        }
      ]
    }

    const orderBy: Prisma.OrderOrderByWithRelationInput[] =
      sortBy === 'status'
        ? [{ status: sortDir }, { createdAt: 'desc' }]
        : sortBy === 'total'
        ? [{ total: sortDir }, { createdAt: 'desc' }]
        : [{ createdAt: sortDir }]

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: true,
              productVariant: true,
            },
          },
          customer: true,
          shippingAddress: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    return NextResponse.json(
      createPaginatedResponse(orders, total, page, limit)
    )
  } catch (error) {
    console.error('Orders fetch error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch orders',
      },
      { status: 500 }
    )
  }
}
