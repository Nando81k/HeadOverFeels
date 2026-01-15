import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { generateProductSchema, generateBreadcrumbSchema, jsonLdScript, combineSchemas } from '@/lib/seo/schemas'
import ProductPageClient from './ProductPageClient'

interface ProductPageProps {
  params: Promise<{
    slug: string
  }>
}

// ===== METADATA GENERATION =====

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  
  const product = await prisma.product.findFirst({
    where: { 
      slug,
      isActive: true,
    },
    include: {
      category: true,
    },
  })

  if (!product) {
    return {
      title: 'Product Not Found | Head Over Feels',
    }
  }

  // Parse images for OG
  let images: string[] = []
  try {
    const parsed = JSON.parse(product.images || '[]')
    images = parsed.map((img: { url: string }) => img.url).slice(0, 4)
  } catch {
    images = []
  }

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com'

  return {
    title: `${product.name} | Head Over Feels`,
    description: product.description || `Shop ${product.name} from Head Over Feels. Premium streetwear and fashion.`,
    keywords: [
      product.name,
      product.category?.name || 'streetwear',
      'fashion',
      'Head Over Feels',
      'premium',
    ].filter(Boolean),
    openGraph: {
      title: product.name,
      description: product.description || `Shop ${product.name} from Head Over Feels`,
      url: `${BASE_URL}/products/${slug}`,
      siteName: 'Head Over Feels',
      images: images.map((url) => ({
        url,
        width: 800,
        height: 800,
        alt: product.name,
      })),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.description || `Shop ${product.name} from Head Over Feels`,
      images: images.slice(0, 1),
    },
    alternates: {
      canonical: `${BASE_URL}/products/${slug}`,
    },
  }
}

// ===== PAGE COMPONENT =====

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  
  // Fetch product for JSON-LD (server-side)
  const product = await prisma.product.findFirst({
    where: { 
      slug,
      isActive: true,
    },
    include: {
      category: true,
      variants: true,
      reviews: {
        where: { status: 'APPROVED' },
      },
    },
  })

  if (!product) {
    notFound()
  }

  // Parse images for schema
  let images: string[] = []
  try {
    const parsed = JSON.parse(product.images || '[]')
    images = parsed.map((img: { url: string }) => img.url)
  } catch {
    images = []
  }

  // Calculate stock status
  const totalStock = product.variants.reduce((sum, v) => sum + v.inventory, 0)
  const inStock = totalStock > 0

  // Calculate review stats
  const reviewCount = product.reviews.length
  const averageRating = reviewCount > 0
    ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
    : undefined

  // Get SKU from first variant if available
  const firstVariant = product.variants[0]

  // Generate JSON-LD schemas
  const productSchema = generateProductSchema({
    name: product.name,
    description: product.description || '',
    slug: product.slug,
    images,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    sku: firstVariant?.sku || undefined,
    brand: 'Head Over Feels',
    category: product.category?.name,
    inStock,
    reviewCount,
    averageRating,
  })

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Products', url: '/products' },
    ...(product.category 
      ? [{ name: product.category.name, url: `/products?category=${product.category.slug}` }]
      : []
    ),
    { name: product.name, url: `/products/${product.slug}` },
  ])

  const combinedSchema = combineSchemas(productSchema, breadcrumbSchema)

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(combinedSchema) }}
      />
      
      {/* Client Component */}
      <ProductPageClient slug={slug} />
    </>
  )
}

// Force dynamic rendering (no static generation during build)
export const dynamic = 'force-dynamic'

