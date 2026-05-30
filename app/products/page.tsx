import { Suspense } from 'react'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { ProductsClientView, ProductsLoadingSkeleton } from '@/components/products/ProductsClientView'
import type { Product } from '@/lib/api/products'

export const revalidate = 300

// ─── SEO helpers ────────────────────────────────────────────────────────────

const CATEGORY_NAMES: Record<string, string> = {
  hoodies: 'Hoodies & Sweatshirts',
  tees: 'T-Shirts',
  tshirts: 'T-Shirts',
  't-shirts': 'T-Shirts',
  tops: 'Tops',
  jackets: 'Jackets',
  bottoms: 'Bottoms',
  accessories: 'Accessories',
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  hoodies:
    'Stay warm in style with premium hoodies and sweatshirts made for comfort and statement fits.',
  tees: 'Essential everyday pieces for a modern streetwear wardrobe.',
  tshirts: 'Essential everyday pieces for a modern streetwear wardrobe.',
  't-shirts': 'Essential everyday pieces for a modern streetwear wardrobe.',
  tops: 'Essential tops designed to layer, style, and repeat.',
  jackets: 'Outerwear built for style and function through every season.',
  bottoms: 'From relaxed joggers to tailored pants, complete the full look.',
  accessories: 'Complete your look with elevated accessories and everyday essentials.',
}

function formatCategoryName(slug: string): string {
  return CATEGORY_NAMES[slug] || slug
}

function getCategoryDescription(slug: string): string {
  return (
    CATEGORY_DESCRIPTIONS[slug] ||
    'Discover premium streetwear pieces designed for authentic expression.'
  )
}

// ─── generateMetadata ────────────────────────────────────────────────────────

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: SearchParams
}): Promise<Metadata> {
  const resolved = searchParams ? await searchParams : {}
  const category = typeof resolved.category === 'string' ? resolved.category : ''

  const title = category
    ? `${formatCategoryName(category)} | Head Over Feels`
    : 'All Products | Head Over Feels'

  const description = getCategoryDescription(category)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  }
}

// ─── Server-side data fetch ──────────────────────────────────────────────────

async function fetchInitialProducts(): Promise<Product[]> {
  try {
    const now = new Date()

    const rows = await prisma.product.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [
              { isLimitedEdition: false },
              {
                AND: [
                  { isLimitedEdition: true },
                  { releaseDate: { lte: now } },
                ],
              },
            ],
          },
        ],
      },
      include: {
        variants: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // Coerce Prisma rows to the Product shape expected by client components.
    // Dates come back as Date objects from Prisma; convert to ISO strings.
    return rows.map((row) => ({
      ...row,
      description: row.description ?? undefined,
      compareAtPrice: row.compareAtPrice ?? undefined,
      materials: row.materials ?? undefined,
      careGuide: row.careGuide ?? undefined,
      categoryId: row.categoryId ?? undefined,
      releaseDate: row.releaseDate ? row.releaseDate.toISOString() : null,
      dropEndDate: row.dropEndDate ? row.dropEndDate.toISOString() : null,
      maxQuantity: row.maxQuantity ?? null,
      isFeaturedNewArrival: row.isFeaturedNewArrival ?? undefined,
      isLimitedEdition: row.isLimitedEdition ?? undefined,
      category: row.category
        ? { id: row.category.id, name: row.category.name, slug: row.category.slug }
        : undefined,
      variants: row.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size ?? undefined,
        color: v.color ?? undefined,
        colorHex: v.colorHex ?? undefined,
        images: v.images ?? undefined,
        price: v.price ?? undefined,
        inventory: v.inventory,
        isActive: v.isActive,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })) as Product[]
  } catch (error) {
    console.error('[products/page] Failed to fetch products from Prisma:', error)
    return []
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  // Await searchParams (Next.js 15+ RSC pattern)
  if (searchParams) await searchParams

  const initialProducts = await fetchInitialProducts()

  return (
    <Suspense fallback={<ProductsLoadingSkeleton />}>
      <ProductsClientView initialProducts={initialProducts} />
    </Suspense>
  )
}
