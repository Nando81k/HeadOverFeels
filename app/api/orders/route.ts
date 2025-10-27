import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

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
  quantity: z.number().int().positive(),
  price: z.number().positive(), // Price at time of purchase
})

const CreateOrderSchema = z.object({
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema,
  items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
  subtotal: z.number().positive(),
  shipping: z.number().min(0),
  tax: z.number().min(0),
  total: z.number().positive(),
  paymentIntentId: z.string().optional(), // Stripe payment intent ID
  sessionId: z.string().optional(), // For releasing cart reservations
})

// POST /api/orders - Create a new order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CreateOrderSchema.parse(body)

    // Start a transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create or find customer
      let customer = await tx.customer.findUnique({
        where: { email: validatedData.customerEmail },
      })

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            email: validatedData.customerEmail,
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
      const orderNumber = `HOF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

      // 5. Fetch product details for order items
      const enrichedItems = await Promise.all(
        validatedData.items.map(async (item) => {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: {
              name: true,
              images: true,
            },
          })

          const variant = item.productVariantId
            ? await tx.productVariant.findUnique({
                where: { id: item.productVariantId },
                select: {
                  size: true,
                  color: true,
                  sku: true,
                },
              })
            : null

          if (!product) {
            throw new Error(`Product ${item.productId} not found`)
          }

          return {
            ...item,
            productName: product.name,
            productImage: product.images ? JSON.parse(product.images as string)[0] : null,
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

      // 6. Create order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerEmail: validatedData.customerEmail,
          customerPhone: validatedData.customerPhone,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
          subtotal: validatedData.subtotal,
          shipping: validatedData.shipping,
          tax: validatedData.tax,
          total: validatedData.total,
          status: 'PENDING',
          paymentStatus: validatedData.paymentIntentId ? 'PENDING' : 'PENDING',
          paymentMethod: 'stripe',
          items: {
            create: enrichedItems.map((item) => ({
              productId: item.productId,
              productVariantId: item.productVariantId,
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

      // 7. Reduce inventory for each item
      for (const item of validatedData.items) {
        if (item.productVariantId) {
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: {
              inventory: {
                decrement: item.quantity,
              },
            },
          })
        }
      }

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

      return order
    })

    return NextResponse.json({
      success: true,
      order: result,
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
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const email = searchParams.get('email')

    const where: Prisma.OrderWhereInput = {}
    
    // If not admin, filter by user's email
    if (!isAdmin && userEmail) {
      where.customerEmail = userEmail
    }
    
    // Admin can filter by specific status
    if (status) {
      where.status = status as Prisma.EnumOrderStatusFilter
    }
    
    // Admin can search by email
    if (email && isAdmin) {
      where.customerEmail = {
        contains: email,
      }
    }

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
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    return NextResponse.json({
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
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
