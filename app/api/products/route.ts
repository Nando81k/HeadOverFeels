import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Helper function to create slug from name
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Validation schema for product creation
const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  compareAtPrice: z.number().optional(),
  images: z.union([
    z.string(), // JSON string
    z.array(z.string()) // Array of strings
  ]).transform(val => {
    // Convert to JSON string if it's an array
    if (Array.isArray(val)) {
      return JSON.stringify(val)
    }
    return val
  }).default('[]'),
  materials: z.string().optional(),
  careGuide: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  categoryId: z.string().nullish().transform(val => val || undefined),
  isLimitedEdition: z.boolean().default(false),
  releaseDate: z.string().nullish().transform(val => val ? new Date(val) : undefined),
  dropEndDate: z.string().nullish().transform(val => val ? new Date(val) : undefined),
  maxQuantity: z.number().int().positive().nullish(),
  variants: z.array(z.object({
    sku: z.string().min(1, 'SKU is required'),
    size: z.string().optional(),
    color: z.string().optional(),
    colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color hex must be in format #RRGGBB').optional().or(z.literal('')),
    images: z.string().optional(),
    price: z.number().optional(),
    inventory: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true)
  })).default([])
})

// GET /api/products - Fetch all products
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const isActive = searchParams.get('isActive') === 'true'
    const isFeatured = searchParams.get('isFeatured') === 'true'

    const skip = (page - 1) * limit

    const where: { isActive?: boolean; isFeatured?: boolean } = {}
    if (isActive) where.isActive = true
    if (isFeatured) where.isFeatured = true

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          variants: true,
          category: true,
          _count: {
            select: { variants: true }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.count({ where })
    ])

    return NextResponse.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

// POST /api/products - Create new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received product data:', JSON.stringify(body, null, 2))
    
    const validatedData = createProductSchema.parse(body)
    console.log('Validated data:', JSON.stringify(validatedData, null, 2))

    const { variants, ...productData } = validatedData

    // Generate slug from name
    const baseSlug = createSlug(productData.name)
    let slug = baseSlug
    let counter = 1

    // Ensure slug is unique
    while (await prisma.product.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Prepare product data
    const productCreateData: {
      name: string
      slug: string
      description?: string
      price: number
      compareAtPrice?: number
      images: string
      materials?: string
      careGuide?: string
      isActive: boolean
      isFeatured: boolean
      categoryId?: string
      isLimitedEdition: boolean
      releaseDate?: Date
      dropEndDate?: Date
      maxQuantity?: number | null
      variants?: {
        create: Array<{
          sku: string
          size?: string
          color?: string
          colorHex?: string
          images?: string
          price?: number
          inventory: number
          isActive: boolean
        }>
      }
    } = {
      ...productData,
      slug,
      maxQuantity: productData.maxQuantity ?? undefined
    }

    if (variants.length > 0) {
      productCreateData.variants = {
        create: variants
      }
    }

    // Check for duplicate SKUs before creating
    if (variants.length > 0) {
      const skus = variants.map(v => v.sku)
      const existingVariants = await prisma.productVariant.findMany({
        where: { sku: { in: skus } },
        select: { sku: true, product: { select: { name: true } } }
      })

      if (existingVariants.length > 0) {
        const duplicates = existingVariants.map(v => 
          `${v.sku} (used in "${v.product.name}")`
        ).join(', ')
        
        return NextResponse.json(
          { 
            error: 'Duplicate SKU(s) found',
            details: `The following SKU(s) already exist: ${duplicates}. Please use unique SKUs for each variant.`
          },
          { status: 400 }
        )
      }
    }

    // Create product with variants
    const product = await prisma.product.create({
      data: productCreateData,
      include: {
        variants: true,
        category: true
      }
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues)
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating product:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Check for Prisma unique constraint errors
    if (error instanceof Error && error.message.includes('Unique constraint failed')) {
      return NextResponse.json(
        { 
          error: 'Duplicate SKU detected',
          details: 'One or more SKUs already exist in the database. Please use unique SKUs for each variant.'
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create product',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}