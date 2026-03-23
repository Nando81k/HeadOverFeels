import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  normalizeCollectionProductSortBy,
  normalizeLegacyCollectionSlug,
} from '@/lib/collections/public-collections'

function matchesProductSearch(
  product: { name: string; description: string | null; slug: string },
  search: string
): boolean {
  const normalized = search.toLowerCase()
  return (
    product.name.toLowerCase().includes(normalized) ||
    product.slug.toLowerCase().includes(normalized) ||
    (product.description ? product.description.toLowerCase().includes(normalized) : false)
  )
}

function isProductInStock(
  product: { variants: Array<{ inventory: number; isActive: boolean }> }
): boolean {
  return product.variants.some((variant) => variant.isActive && variant.inventory > 0)
}

async function getCollectionById(id: string) {
  return prisma.collection.findUnique({
    where: { id },
    include: {
      products: {
        where: {
          product: {
            isActive: true,
          },
        },
        include: {
          product: {
            include: {
              variants: true,
              category: true,
            },
          },
        },
        orderBy: {
          sortOrder: 'asc',
        },
      },
      _count: {
        select: { products: true },
      },
    },
  })
}

type CollectionWithProducts = NonNullable<Awaited<ReturnType<typeof getCollectionById>>>
type CollectionProductRow = CollectionWithProducts['products'][number]

function sortCollectionProducts(rows: CollectionProductRow[], sortBy: ReturnType<typeof normalizeCollectionProductSortBy>) {
  return [...rows].sort((first, second) => {
    if (sortBy === 'newest') {
      const firstDate = new Date(first.product.createdAt).getTime()
      const secondDate = new Date(second.product.createdAt).getTime()
      if (firstDate !== secondDate) {
        return secondDate - firstDate
      }
      return first.sortOrder - second.sortOrder
    }

    if (sortBy === 'priceAsc') {
      if (first.product.price !== second.product.price) {
        return first.product.price - second.product.price
      }
      return first.sortOrder - second.sortOrder
    }

    if (sortBy === 'priceDesc') {
      if (first.product.price !== second.product.price) {
        return second.product.price - first.product.price
      }
      return first.sortOrder - second.sortOrder
    }

    if (sortBy === 'name') {
      const nameCompare = first.product.name.localeCompare(second.product.name)
      if (nameCompare !== 0) {
        return nameCompare
      }
      return first.sortOrder - second.sortOrder
    }

    return first.sortOrder - second.sortOrder
  })
}

async function resolveCollectionBySlug(requestedSlug: string) {
  const normalizedRequestedSlug = normalizeLegacyCollectionSlug(requestedSlug)

  if (!normalizedRequestedSlug) {
    return null
  }

  let collection = await prisma.collection.findFirst({
    where: {
      slug: requestedSlug,
      isActive: true,
    },
    select: { id: true },
  })

  if (!collection && normalizedRequestedSlug !== requestedSlug) {
    collection = await prisma.collection.findFirst({
      where: {
        slug: normalizedRequestedSlug,
        isActive: true,
      },
      select: { id: true },
    })
  }

  if (!collection) {
    const activeCollections = await prisma.collection.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    })

    const matchedCollection = activeCollections.find((candidate) => {
      return (
        normalizeLegacyCollectionSlug(candidate.slug) === normalizedRequestedSlug ||
        normalizeLegacyCollectionSlug(candidate.name) === normalizedRequestedSlug
      )
    })

    if (matchedCollection) {
      collection = { id: matchedCollection.id }
    }
  }

  if (!collection) {
    return null
  }

  return getCollectionById(collection.id)
}

// GET /api/collections/slug/[slug] - Fetch active collection by slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params
    const requestedSlug = decodeURIComponent(rawSlug).trim()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search')?.trim() ?? ''
    const inStock = searchParams.get('inStock') === 'true'
    const sortBy = normalizeCollectionProductSortBy(searchParams.get('sortBy'))

    if (search.length > 120) {
      return NextResponse.json(
        { error: 'Search query is too long' },
        { status: 400 }
      )
    }

    const collection = await resolveCollectionBySlug(requestedSlug)

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    let filteredRows = [...collection.products]

    if (search) {
      filteredRows = filteredRows.filter((row) =>
        matchesProductSearch(row.product, search)
      )
    }

    if (inStock) {
      filteredRows = filteredRows.filter((row) =>
        isProductInStock(row.product)
      )
    }

    const sortedRows = sortCollectionProducts(filteredRows, sortBy)

    const resolvedSlug = collection.slug
    const isCanonical = resolvedSlug === requestedSlug

    return NextResponse.json({
      collection: {
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        description: collection.description,
        image: collection.image,
        isFeatured: collection.isFeatured,
        sortOrder: collection.sortOrder,
        productCount: collection.products.length,
        totalAssignedCount: collection._count.products,
      },
      products: sortedRows.map((row) => row.product),
      filters: {
        search,
        sortBy,
        inStock,
      },
      counts: {
        totalProducts: collection.products.length,
        filteredProducts: sortedRows.length,
      },
      meta: {
        requestedSlug,
        resolvedSlug,
        isCanonical,
      },
    })
  } catch (error) {
    console.error('Error fetching collection by slug:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collection' },
      { status: 500 }
    )
  }
}
