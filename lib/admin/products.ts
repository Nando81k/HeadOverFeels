// lib/admin/products.ts
//
// Single source of truth for Phase 3 products data shapes and Prisma queries.
// All loaders are pure async functions called from Server Components.
//
// Schema adaptations (real field names vs plan assumptions):
//   - Product has NO `status` enum field — uses `isActive: Boolean` + `dropEndDate` instead.
//     ProductStatus ('ACTIVE' | 'DRAFT' | 'ARCHIVED') is derived: ACTIVE=isActive, ARCHIVED=!isActive.
//     DRAFT is not directly representable in schema — tracked as follow-up.
//   - Product has NO `tags` field — tags are not stored on the model; returned as [].
//     Follow-up: add tags support to schema.
//   - Product has NO `sku` field — sku lives on ProductVariant. `productSku` uses first variant's sku.
//   - Product `isFeatured` (not `featured`) — all `featured` refs adapted to `isFeatured`.
//   - Product `maxQuantity` (not `dropMaxQuantity`) — used for drop stock max.
//   - Product `dropQuantitySold` does NOT exist — drop stock used = maxQuantity - sum(variant.inventory)
//     when maxQuantity is set; otherwise null. Documented as follow-up for order-based tracking.
//   - Product `dropAccessTier` does NOT exist — accessTier always returns null. Follow-up.
//   - CollectionProduct uses `sortOrder` (not `position`) for ordering.
//   - ReviewReply model does NOT exist — Review has inline adminReply/adminReplyBy/adminReplyAt fields.
//     loadReviewWithReplies synthesises a single ReviewReply from these inline fields if adminReply != null.
//   - Review body field is `comment` (not `body`).
//   - Review has NO `isReported` field — isReported always returns false. Follow-up.
//   - Review status includes FLAGGED (4 values: PENDING | APPROVED | REJECTED | FLAGGED).
//     FLAGGED is exposed as 'REJECTED' in the UI type for simplicity; callers can pass 'FLAGGED'
//     directly in filters and the loader treats it as-is.

import { prisma } from '@/lib/prisma'

// ============================================================
// Types
// ============================================================

export const TABS = ['all', 'drops', 'drafts', 'collections', 'reviews', 'archived'] as const
export type ProductsTab = (typeof TABS)[number]

export function isProductsTab(value: unknown): value is ProductsTab {
  return typeof value === 'string' && (TABS as readonly string[]).includes(value)
}

/**
 * Derived product status for the admin UI.
 * 'ACTIVE'   → isActive=true
 * 'ARCHIVED' → isActive=false
 * 'DRAFT'    → not directly representable in current schema (follow-up)
 */
export type ProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
export const STATUSES: ReadonlyArray<ProductStatus> = ['ACTIVE', 'DRAFT', 'ARCHIVED']

export type SortOption =
  | 'newest'
  | 'oldest'
  | 'price-asc'
  | 'price-desc'
  | 'inventory-asc'
  | 'inventory-desc'
  | 'best-sellers'

export interface ProductsListFilters {
  search?: string
  category?: string
  status?: ProductStatus
  tag?: string
  sort?: SortOption
  page?: number
  pageSize?: number
}

export interface ProductRow {
  id: string
  name: string
  slug: string
  category: string | null
  variantCount: number
  /** First variant's SKU, or null if no variants */
  sku: string | null
  price: number
  inventory: number
  status: ProductStatus
  primaryImage: string | null
  /** Derived: true when dropEndDate != null */
  isDrop: boolean
  dropEndDate: Date | null
  /** { used: maxQuantity - sumInventory, max: maxQuantity } | null */
  dropStock: { used: number; max: number } | null
  /**
   * Tags are not in the current schema — always [].
   * Follow-up: add tags field to Product model.
   */
  tags: string[]
  /** Maps to Product.isFeatured */
  featured: boolean
}

export interface ProductsKpiData {
  active: number
  dropsLive: number
  lowStock: number
  drafts: number
}

export interface CategoryOption {
  id: string
  name: string
}
export interface TagOption {
  value: string
  count: number
}

export interface CollectionListItem {
  id: string
  name: string
  slug: string
  productCount: number
  primaryImage: string | null
  updatedAt: Date
}

export interface CollectionProductRef {
  id: string
  name: string
  primaryImage: string | null
  /** Maps to CollectionProduct.sortOrder (schema uses sortOrder, not position) */
  position: number
}

export interface CollectionWithProducts {
  id: string
  name: string
  description: string | null
  products: CollectionProductRef[]
}

export interface ReviewItem {
  id: string
  customerName: string
  rating: number
  title: string
  /** Maps to Review.comment field */
  body: string
  productName: string
  /** First variant SKU or null */
  productSku: string | null
  productId: string
  createdAt: Date
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED'
  /**
   * isReported does not exist in schema — always false.
   * Follow-up: add isReported field to Review model.
   */
  isReported: boolean
}

/**
 * ReviewReply model does NOT exist in schema.
 * This type is synthesised from Review.adminReply / adminReplyBy / adminReplyAt inline fields.
 * At most one reply per review is supported. Follow-up: add ReviewReply relation model.
 */
export interface ReviewReply {
  id: string
  body: string
  authorName: string
  createdAt: Date
}

export interface ReviewWithReplies extends ReviewItem {
  /** 0 or 1 entry — synthesised from Review.adminReply inline fields */
  replies: ReviewReply[]
}

export interface ReviewsFilters {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED' | 'REPORTED'
  page?: number
  pageSize?: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ProductDetailForInspector {
  id: string
  name: string
  price: number
  inventory: number
  status: ProductStatus
  /** Always [] — tags not in schema. Follow-up. */
  tags: string[]
  /** Maps to Product.isFeatured */
  featured: boolean
  primaryImage: string | null
  /** Derived: true when dropEndDate != null */
  isDrop: boolean
  dropEndDate: Date | null
  /** { used: maxQuantity - sumInventory, max: maxQuantity } | null */
  dropStock: { used: number; max: number } | null
  /**
   * dropAccessTier does not exist in schema — always null.
   * Follow-up: add dropAccessTier field to Product model.
   */
  accessTier: string | null
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_PAGE_SIZE = 25
const LOW_STOCK_THRESHOLD = 10

// ============================================================
// Helpers
// ============================================================

function extractPrimaryImage(imagesJson: unknown): string | null {
  if (typeof imagesJson !== 'string') return null
  try {
    const arr = JSON.parse(imagesJson)
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0]
      if (typeof first === 'string') return first
      if (typeof first === 'object' && first?.url) return first.url as string
    }
  } catch {
    /* malformed images JSON — ignore */
  }
  return null
}

/**
 * Derive ProductStatus from Product.isActive.
 * Note: DRAFT is not representable in current schema.
 */
function deriveStatus(isActive: boolean): ProductStatus {
  return isActive ? 'ACTIVE' : 'ARCHIVED'
}

/**
 * Derive drop stock used from maxQuantity and current variant inventory sum.
 * Formula: used = maxQuantity - sumInventory (clamped to 0).
 * Note: this is an approximation — orders with returns/cancellations may skew the number.
 * Follow-up: replace with order-line aggregate for accuracy.
 */
function deriveDropStock(
  maxQuantity: number | null,
  sumInventory: number,
): { used: number; max: number } | null {
  if (maxQuantity == null) return null
  return { used: Math.max(0, maxQuantity - sumInventory), max: maxQuantity }
}

function sortToOrderBy(sort: SortOption | undefined) {
  switch (sort) {
    case 'oldest':
      return { createdAt: 'asc' as const }
    case 'price-asc':
      return { price: 'asc' as const }
    case 'price-desc':
      return { price: 'desc' as const }
    case 'inventory-asc':
    case 'inventory-desc':
      // Product has no denormalised inventory field — fall back to newest.
      // TODO: replace with raw SQL aggregate sort if needed.
      return { createdAt: 'desc' as const }
    case 'best-sellers':
      // TODO: replace with real 30-day sales aggregate.
      return { createdAt: 'desc' as const }
    case 'newest':
    default:
      return { createdAt: 'desc' as const }
  }
}

// ============================================================
// KPIs
// ============================================================

export async function loadProductsKpis(): Promise<ProductsKpiData> {
  const now = new Date()
  const [active, dropsLive, lowStockVariants] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({
      where: { dropEndDate: { gte: now }, isActive: true },
    }),
    prisma.productVariant.count({ where: { inventory: { lte: LOW_STOCK_THRESHOLD } } }),
  ])
  // DRAFT is not representable in schema — always 0. Follow-up.
  return { active, dropsLive, lowStock: lowStockVariants, drafts: 0 }
}

// ============================================================
// Per-tab loaders
// ============================================================

export async function loadProductsTab(
  tab: ProductsTab,
  filters: ProductsListFilters = {},
): Promise<PaginatedResult<ProductRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  // Build isActive filter from tab + optional filter override
  const isActiveFilter: boolean | undefined =
    tab === 'archived' ? false
    : tab === 'all' ? undefined // all statuses
    : true // drops, drafts — active only (drafts fall-back to same since schema has no DRAFT)

  const where: Record<string, unknown> = {}

  if (isActiveFilter !== undefined) where.isActive = isActiveFilter

  if (filters.status) {
    if (filters.status === 'ARCHIVED') where.isActive = false
    else if (filters.status === 'ACTIVE') where.isActive = true
    // DRAFT → no-op (not in schema)
  }

  if (filters.category) where.categoryId = filters.category

  // tags filter — Product has no tags field; skip silently. Follow-up.

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  if (tab === 'drops') {
    where.dropEndDate = { gte: new Date() }
  }

  const orderBy =
    tab === 'drops' && !filters.sort
      ? { dropEndDate: 'asc' as const }
      : sortToOrderBy(filters.sort)

  const [rawProducts, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: {
        category: { select: { name: true } },
        variants: { select: { inventory: true, sku: true } },
      },
    }),
    prisma.product.count({ where }),
  ])

  const items: ProductRow[] = rawProducts.map((p) => {
    const sumInventory = p.variants.reduce((s, v) => s + v.inventory, 0)
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category?.name ?? null,
      variantCount: p.variants.length,
      sku: p.variants[0]?.sku ?? null,
      price: Number(p.price),
      inventory: sumInventory,
      status: deriveStatus(p.isActive),
      primaryImage: extractPrimaryImage(p.images),
      isDrop: p.dropEndDate != null,
      dropEndDate: p.dropEndDate ?? null,
      dropStock: deriveDropStock(p.maxQuantity, sumInventory),
      tags: [], // not in schema — follow-up
      featured: p.isFeatured,
    }
  })

  return { items, total, page, pageSize }
}

// ============================================================
// Filter option loaders
// ============================================================

export async function loadCategories(): Promise<CategoryOption[]> {
  const cats = await prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return cats
}

/**
 * Tags are not stored on Product in the current schema.
 * Always returns []. Follow-up: add tags field and implement real aggregation.
 */
export async function loadTags(): Promise<TagOption[]> {
  return []
}

// ============================================================
// Collections
// ============================================================

export async function loadCollections(): Promise<CollectionListItem[]> {
  const cols = await prisma.collection.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { products: true } } },
  })
  return cols.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    productCount: c._count.products,
    primaryImage: extractPrimaryImage(c.image ?? null),
    updatedAt: c.updatedAt,
  }))
}

export async function loadCollectionDetail(id: string): Promise<CollectionWithProducts | null> {
  // CollectionProduct uses `sortOrder` (plan assumed `position`) — adapted here.
  const col = await prisma.collection.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { sortOrder: 'asc' },
        include: { product: { select: { id: true, name: true, images: true } } },
      },
    },
  })
  if (!col) return null
  return {
    id: col.id,
    name: col.name,
    description: col.description ?? null,
    products: col.products.map((jp) => ({
      id: jp.product.id,
      name: jp.product.name,
      primaryImage: extractPrimaryImage(jp.product.images),
      position: jp.sortOrder, // exposed as `position` in the interface for dnd-kit
    })),
  }
}

// ============================================================
// Reviews
// ============================================================

export async function loadReviewsList(
  filters: ReviewsFilters = {},
): Promise<PaginatedResult<ReviewItem>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  // `isReported` does not exist — 'REPORTED' filter falls back to PENDING for now. Follow-up.
  if (filters.status === 'REPORTED') {
    where.status = 'PENDING'
  } else if (filters.status) {
    where.status = filters.status
  } else {
    where.status = 'PENDING'
  }

  const [raw, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            variants: { select: { sku: true }, take: 1 },
          },
        },
      },
    }),
    prisma.review.count({ where }),
  ])

  return {
    items: raw.map((r) => ({
      id: r.id,
      customerName: r.customerName,
      rating: r.rating,
      title: r.title ?? '',
      body: r.comment, // Review.comment maps to the plan's `body` field
      productName: r.product?.name ?? 'Unknown product',
      productSku: r.product?.variants[0]?.sku ?? null,
      productId: r.product?.id ?? '',
      createdAt: r.createdAt,
      status: r.status as ReviewItem['status'],
      isReported: false, // isReported not in schema — follow-up
    })),
    total,
    page,
    pageSize,
  }
}

/**
 * ReviewReply model does NOT exist.
 * Synthesises 0 or 1 reply from Review.adminReply / adminReplyBy / adminReplyAt inline fields.
 */
export async function loadReviewWithReplies(id: string): Promise<ReviewWithReplies | null> {
  const r = await prisma.review.findUnique({
    where: { id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          variants: { select: { sku: true }, take: 1 },
        },
      },
    },
  })
  if (!r) return null

  // Synthesise reply from inline adminReply fields
  const replies: ReviewReply[] =
    r.adminReply != null
      ? [
          {
            id: `${r.id}:reply`,
            body: r.adminReply,
            authorName: r.adminReplyBy ?? 'Admin',
            createdAt: r.adminReplyAt ?? r.updatedAt,
          },
        ]
      : []

  return {
    id: r.id,
    customerName: r.customerName,
    rating: r.rating,
    title: r.title ?? '',
    body: r.comment,
    productName: r.product?.name ?? 'Unknown product',
    productSku: r.product?.variants[0]?.sku ?? null,
    productId: r.product?.id ?? '',
    createdAt: r.createdAt,
    status: r.status as ReviewItem['status'],
    isReported: false, // not in schema — follow-up
    replies,
  }
}

// ============================================================
// Product detail (Inspector)
// ============================================================

export async function loadProductDetail(id: string): Promise<ProductDetailForInspector | null> {
  const p = await prisma.product.findUnique({
    where: { id },
    include: { variants: { select: { inventory: true } } },
  })
  if (!p) return null
  const sumInventory = p.variants.reduce((s, v) => s + v.inventory, 0)
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price),
    inventory: sumInventory,
    status: deriveStatus(p.isActive),
    tags: [], // not in schema — follow-up
    featured: p.isFeatured,
    primaryImage: extractPrimaryImage(p.images),
    isDrop: p.dropEndDate != null,
    dropEndDate: p.dropEndDate ?? null,
    dropStock: deriveDropStock(p.maxQuantity, sumInventory),
    accessTier: null, // dropAccessTier not in schema — follow-up
  }
}
