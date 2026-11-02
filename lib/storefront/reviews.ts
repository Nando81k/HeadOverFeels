// lib/storefront/reviews.ts
//
// Storefront reviews, keyed by Shopify product handle (Phase 5 plan, Task 2;
// design spec decision 11). Server-only: Prisma reads behind `unstable_cache`,
// one write path (`createReview`) that always lands a review in moderation.
//
// Reads never throw: the home page is prerendered at build time without a
// database, and a reviews outage must not take a PDP down — both degrade to
// "no reviews". The write path throws `ReviewError` with a code the action maps
// to copy.

import 'server-only'

import { unstable_cache } from 'next/cache'
import type { Prisma } from '@prisma/client'

import { resolveCustomer } from '@/lib/loyalty/shopify-bridge'
import { prisma } from '@/lib/prisma'
import { getCustomerOrders } from '@/lib/shopify/customer/queries'
import { isAccessTokenFresh, type CustomerSession } from '@/lib/shopify/customer/session'

export type Rating = 1 | 2 | 3 | 4 | 5

export type ReviewSummary = {
  handle: string
  /** Mean rating, 0 when there are no reviews. */
  average: number
  count: number
  distribution: Record<Rating, number>
}

export type ReviewItem = {
  id: string
  rating: Rating
  title: string | null
  comment: string
  /** "Nando R." — first name and last initial. */
  authorName: string
  isVerified: boolean
  /** ISO timestamp. */
  createdAt: string
  adminReply: string | null
  helpfulCount: number
}

export type ReviewPage = { items: ReviewItem[]; nextCursor: string | null; total: number }
export type ReviewSort = 'newest' | 'highest' | 'lowest' | 'helpful'

export type HomeReview = ReviewItem & { productHandle: string; productTitle: string | null }

export type CreateReviewInput = {
  handle: string
  /** Used for the verified-purchase match and as a fallback product name. */
  productTitle: string
  rating: number
  title?: string | null
  comment: string
}

export type ReviewErrorCode = 'ALREADY_REVIEWED' | 'UNAVAILABLE'

export class ReviewError extends Error {
  code: ReviewErrorCode
  constructor(code: ReviewErrorCode, message: string) {
    super(message)
    this.name = 'ReviewError'
    this.code = code
  }
}

/** Cache tag for everything about one product's reviews. */
export const reviewsTag = (handle: string) => `reviews:${handle}`
/** Reviews are moderated, so five minutes of staleness is invisible. */
export const REVIEWS_REVALIDATE = 300
/** Default page size on the PDP. */
export const REVIEWS_PAGE_SIZE = 6
/** Reviews shown on the home strip. */
export const HOME_REVIEWS_LIMIT = 3
/** Home strip shows only the glowing ones. */
export const HOME_REVIEWS_MIN_RATING = 4
/** How many recent orders the verified-purchase check looks through. */
const VERIFY_ORDERS_FIRST = 50

export const EMPTY_SUMMARY = (handle: string): ReviewSummary => ({
  handle,
  average: 0,
  count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
})


function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toRating(value: number): Rating {
  const clamped = Math.min(5, Math.max(1, Math.round(value)))
  return clamped as Rating
}

/** "Nando Rodriguez" → "Nando R."; "nando" → "Nando"; "" → "Customer". */
export function authorDisplayName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Customer'
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  if (parts.length === 1) return first
  return `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`
}

type ReviewRow = {
  id: string
  rating: number
  title: string | null
  comment: string
  customerName: string
  isVerified: boolean
  createdAt: Date
  adminReply: string | null
  helpfulCount: number
}

const REVIEW_SELECT = {
  id: true,
  rating: true,
  title: true,
  comment: true,
  customerName: true,
  isVerified: true,
  createdAt: true,
  adminReply: true,
  helpfulCount: true,
} satisfies Prisma.ReviewSelect

export function toReviewItem(row: ReviewRow): ReviewItem {
  return {
    id: row.id,
    rating: toRating(row.rating),
    title: row.title,
    comment: row.comment,
    authorName: authorDisplayName(row.customerName),
    isVerified: row.isVerified,
    createdAt: row.createdAt.toISOString(),
    adminReply: row.adminReply,
    helpfulCount: row.helpfulCount,
  }
}

function orderBy(sort: ReviewSort): Prisma.ReviewOrderByWithRelationInput[] {
  switch (sort) {
    case 'highest':
      return [{ rating: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
    case 'lowest':
      return [{ rating: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }]
    case 'helpful':
      return [{ helpfulCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
    default:
      return [{ createdAt: 'desc' }, { id: 'desc' }]
  }
}

// ---------------------------------------------------------------- reads

async function loadSummary(handle: string): Promise<ReviewSummary> {
  const groups = await prisma.review.groupBy({
    by: ['rating'],
    where: { productHandle: handle, status: 'APPROVED' },
    _count: { _all: true },
  })
  const distribution = EMPTY_SUMMARY(handle).distribution
  let count = 0
  let sum = 0
  for (const group of groups) {
    const rating = toRating(group.rating)
    const n = group._count._all
    distribution[rating] += n
    count += n
    sum += rating * n
  }
  return { handle, average: count > 0 ? sum / count : 0, count, distribution }
}

/** Approved-review summary for the PDP title block and `aggregateRating`. */
export async function getReviewSummary(handle: string): Promise<ReviewSummary> {
  try {
    return await unstable_cache(() => loadSummary(handle), ['reviews-summary', handle], {
      revalidate: REVIEWS_REVALIDATE,
      tags: [reviewsTag(handle)],
    })()
  } catch (error) {
    console.warn(`[storefront] review summary unavailable for ${handle}: ${errorMessage(error)}`)
    return EMPTY_SUMMARY(handle)
  }
}

export type ListReviewsArgs = { cursor?: string | null; limit?: number; sort?: ReviewSort }

async function loadReviews(handle: string, args: Required<ListReviewsArgs>): Promise<ReviewPage> {
  const where: Prisma.ReviewWhereInput = { productHandle: handle, status: 'APPROVED' }
  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: orderBy(args.sort),
      take: args.limit + 1,
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
      select: REVIEW_SELECT,
    }),
    prisma.review.count({ where }),
  ])
  const hasMore = rows.length > args.limit
  const items = (hasMore ? rows.slice(0, args.limit) : rows).map(toReviewItem)
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null, total }
}

/** One page of approved reviews. The first page is cached with the PDP; later pages are live. */
export async function listReviews(handle: string, args: ListReviewsArgs = {}): Promise<ReviewPage> {
  const resolved = {
    cursor: args.cursor ?? null,
    limit: Math.min(50, Math.max(1, args.limit ?? REVIEWS_PAGE_SIZE)),
    sort: args.sort ?? 'newest',
  }
  try {
    if (resolved.cursor) return await loadReviews(handle, resolved)
    return await unstable_cache(
      () => loadReviews(handle, resolved),
      ['reviews-page', handle, resolved.sort, String(resolved.limit)],
      { revalidate: REVIEWS_REVALIDATE, tags: [reviewsTag(handle)] }
    )()
  } catch (error) {
    console.warn(`[storefront] reviews unavailable for ${handle}: ${errorMessage(error)}`)
    return { items: [], nextCursor: null, total: 0 }
  }
}

async function loadHomeReviews(limit: number): Promise<HomeReview[]> {
  const rows = await prisma.review.findMany({
    where: { status: 'APPROVED', rating: { gte: HOME_REVIEWS_MIN_RATING }, productHandle: { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
    select: { ...REVIEW_SELECT, productHandle: true, product: { select: { name: true } } },
  })
  return rows.map((row) => ({
    ...toReviewItem(row),
    productHandle: row.productHandle as string,
    productTitle: row.product?.name ?? null,
  }))
}

/** The newest glowing reviews for the home strip; empty on any failure. */
export async function getHomeReviews(limit = HOME_REVIEWS_LIMIT): Promise<HomeReview[]> {
  try {
    return await unstable_cache(() => loadHomeReviews(limit), ['reviews-home', String(limit)], {
      revalidate: REVIEWS_REVALIDATE,
      tags: ['reviews:home'],
    })()
  } catch (error) {
    console.warn(`[storefront] home reviews unavailable: ${errorMessage(error)}`)
    return []
  }
}

// ---------------------------------------------------------------- write

/**
 * Did this customer buy the product? The Customer Account API does not expose
 * line-item product ids on this store's version, so the check matches line
 * titles against the product title across recent orders. A stale token means
 * "unknown" → unverified, never a refresh from here.
 */
export async function hasPurchased(session: CustomerSession, productTitle: string): Promise<boolean> {
  if (!isAccessTokenFresh(session)) return false
  const wanted = productTitle.trim().toLowerCase()
  if (!wanted) return false
  try {
    const page = await getCustomerOrders(session.tokens.accessToken, { first: VERIFY_ORDERS_FIRST })
    return page.orders.some((order) =>
      order.lineItems.some((line) => line.title.trim().toLowerCase() === wanted)
    )
  } catch (error) {
    console.warn(`[storefront] purchase check skipped: ${errorMessage(error)}`)
    return false
  }
}

/** Full name from the session, falling back to the email's local part. */
function sessionName(session: CustomerSession): string {
  const name = [session.firstName, session.lastName].map((part) => part?.trim() ?? '').filter(Boolean).join(' ')
  return name || session.email.split('@')[0] || 'Customer'
}

/**
 * Creates a `PENDING` review for the signed-in customer. One review per
 * customer per product. Writes the handle always and the legacy product id
 * when a Prisma product with that slug exists (keeps `/admin/reviews` whole).
 */
export async function createReview(
  input: CreateReviewInput,
  session: CustomerSession
): Promise<{ id: string; status: 'PENDING'; isVerified: boolean }> {
  const { id: customerId } = await resolveCustomer({
    shopifyCustomerId: session.customerId,
    email: session.email,
    firstName: session.firstName,
    lastName: session.lastName,
  })

  const existing = await prisma.review.findFirst({
    where: { productHandle: input.handle, OR: [{ customerId }, { customerEmail: session.email }] },
    select: { id: true },
  })
  if (existing) throw new ReviewError('ALREADY_REVIEWED', 'You have already reviewed this product.')

  const [product, isVerified] = await Promise.all([
    prisma.product.findUnique({ where: { slug: input.handle }, select: { id: true } }),
    hasPurchased(session, input.productTitle),
  ])

  const review = await prisma.review.create({
    data: {
      productHandle: input.handle,
      productId: product?.id ?? null,
      customerId,
      rating: toRating(input.rating),
      title: input.title?.trim() || null,
      comment: input.comment.trim(),
      customerName: sessionName(session),
      customerEmail: session.email,
      isVerified,
      status: 'PENDING',
    },
    select: { id: true },
  })
  return { id: review.id, status: 'PENDING', isVerified }
}
