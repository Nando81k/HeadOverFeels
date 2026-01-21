import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { isValidGuestEmail } from '@/lib/security/guest-session'
import { getPaginationParams, createPaginatedResponse } from '@/lib/validation/schemas'

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
  price: z.number().positive('Price must be positive'),
})

const CreateOrderSchema = z.object({
  customerEmail: z.string().email('Invalid email'),
  customerPhone: z.string().optional(),
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema,
  items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
  subtotal: z.number().positive('Subtotal must be positive'),
  discount: z.number().min(0, 'Discount must be non-negative').default(0),
  shipping: z.number().min(0, 'Shipping must be non-negative'),
  tax: z.number().min(0, 'Tax must be non-negative'),
  total: z.number().positive('Total must be positive'),
  shippingMethod: z.string().optional(), // STANDARD, EXPRESS, OVERNIGHT
  paymentIntentId: z.string().optional(),
  sessionId: z.string().optional(),
  couponCode: z.string().optional(),
  redemptionId: z.string().optional(),
  promotionId: z.string().optional(), // For marketing promotions
})

// POST /api/orders - Create a new order
// For guest checkouts: validates guest email against x-guest-email header
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CreateOrderSchema.parse(body)

    // Validate guest email if provided
    const headerEmail = request.headers.get('x-guest-email')
    if (headerEmail) {
      const bodyEmail = validatedData.customerEmail.toLowerCase().trim()
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

          // Only fetch variant if productVariantId is provided and not empty
          const variant = item.productVariantId && item.productVariantId.trim() !== ''
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

          // Parse images and extract URL from the first image object
          let imageUrl: string | null = null
          if (product.images) {
            try {
              const parsedImages = JSON.parse(product.images as string)
              if (Array.isArray(parsedImages) && parsedImages.length > 0) {
                imageUrl = parsedImages[0]?.url || null
              }
            } catch (error) {
              console.error('Error parsing product images:', error)
            }
          }

          return {
            ...item,
            productVariantId: item.productVariantId && item.productVariantId.trim() !== '' 
              ? item.productVariantId 
              : undefined,
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

      // Log enriched items for debugging
      console.log('Enriched items before order creation:', JSON.stringify(enrichedItems, null, 2))
      console.log('Customer ID:', customer.id)
      console.log('Shipping Address ID:', shippingAddress.id)
      console.log('Billing Address ID:', billingAddress.id)

      // Validate that all productIds exist
      for (const item of enrichedItems) {
        const productExists = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true }
        })
        if (!productExists) {
          throw new Error(`Product ${item.productId} does not exist. Please refresh your cart and try again.`)
        }
        
        if (item.productVariantId) {
          const variantExists = await tx.productVariant.findUnique({
            where: { id: item.productVariantId },
            select: { id: true, size: true, color: true }
          })
          if (!variantExists) {
            throw new Error(`The selected variant for "${productExists.name}" is no longer available. Please remove it from your cart and add it again with an available size/color.`)
          }
        }
      }

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
          discount: validatedData.discount || 0,
          shipping: validatedData.shipping,
          tax: validatedData.tax,
          total: validatedData.total,
          shippingMethod: validatedData.shippingMethod || null,
          couponCode: validatedData.couponCode || null,
          redemptionId: validatedData.redemptionId || null,
          status: 'PENDING',
          paymentStatus: validatedData.paymentIntentId ? 'PENDING' : 'PENDING',
          paymentMethod: 'stripe',
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
              totalDiscountGiven: { increment: validatedData.discount },
            },
          })
        }
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
    
    // Validate pagination parameters
    const { searchParams } = new URL(request.url)
    const { page, limit } = getPaginationParams(new URL(request.url).searchParams)
    const status = searchParams.get('status')
    const search = searchParams.get('search') // New unified search param

    const where: Prisma.OrderWhereInput = {}
    
    // If not admin, filter by user's email
    if (!isAdmin && userEmail) {
      where.customerEmail = userEmail
    }
    
    // Admin can filter by specific status
    if (status) {
      where.status = status as Prisma.EnumOrderStatusFilter
    }
    
    // Admin can search by email, order number, or customer name
    if (search && isAdmin) {
      const cleanSearch = search.substring(0, 255).trim().toLowerCase()
      where.OR = [
        { orderNumber: { contains: cleanSearch } },
        { customerEmail: { contains: cleanSearch } },
        { 
          shippingAddress: { 
            OR: [
              { firstName: { contains: cleanSearch } },
              { lastName: { contains: cleanSearch } },
            ]
          } 
        },
        {
          customer: {
            OR: [
              { name: { contains: cleanSearch } },
              { email: { contains: cleanSearch } },
            ]
          }
        }
      ]
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
