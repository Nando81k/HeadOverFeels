// app/admin/products/actions.ts
'use server'

/**
 * Phase 3 — Admin Products Server Actions (13 actions)
 *
 * Schema adaptations from plan:
 *  - Plan assumed Product.featured    → actual field is Product.isFeatured
 *  - Plan assumed Product.tags[]      → NO tags field on Product in schema
 *                                       bulkAddTag stubs with { ok: false } + TODO comment
 *                                       QuickEditFields.tags dropped
 *  - Plan assumed Product.status enum (ACTIVE/DRAFT/ARCHIVED)
 *                                     → actual: Product.isActive boolean
 *                                     → "archive" = set isActive=false
 *  - Plan assumed junction model productOnCollections with position field
 *                                     → actual: CollectionProduct with sortOrder
 *                                     → Prisma accessor: prisma.collectionProduct
 *  - Plan assumed ReviewReply model   → NOT in schema
 *                                     → Review has inline fields: adminReply, adminReplyBy, adminReplyAt
 *                                     → replyToReview() writes those inline fields
 *  - requireAdmin() / requireAdminRole() are server-action-compatible (no NextRequest)
 *    — lib/auth/admin.ts now exports overloaded requireAdmin() and requireAdminRole()
 */

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireAdminRole } from '@/lib/auth/admin'

// ============================================================
// Return types
// ============================================================

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export type BulkResult =
  | { ok: true; affected: number }
  | { ok: false; error: string }

// ============================================================
// Internal helpers
// ============================================================

const ADMIN_REVALIDATE_PATHS = ['/admin', '/admin/products']

function revalidateProducts() {
  for (const p of ADMIN_REVALIDATE_PATHS) revalidatePath(p)
}

function rejectEmpty(ids: string[]): BulkResult | null {
  if (ids.length === 0) return { ok: false, error: 'No products selected' }
  return null
}

function roundToCent(n: number): number {
  return Math.round(n * 100) / 100
}

// ============================================================
// Types
// ============================================================

/** Product status as understood by the admin UI. Mapped to isActive boolean. */
export type ProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED'

/**
 * Fields editable via the Inspector quick-edit panel.
 *
 * Note: plan included `tags: string[]` and `featured: boolean` —
 * actual schema has no Product.tags field, and uses Product.isFeatured.
 * Tags have been removed; isFeatured replaces featured.
 */
export interface QuickEditFields {
  name: string
  price: number
  /** Status mapped to isActive on the Product model */
  status: ProductStatus
  /**
   * isFeatured — maps to Product.isFeatured.
   * Plan assumed `featured` but actual schema field is `isFeatured`.
   */
  isFeatured: boolean
}

// ============================================================
// 1. Quick-edit (Inspector save)
// ============================================================

export async function saveProductQuickEdit(
  productId: string,
  fields: QuickEditFields,
): Promise<ActionResult> {
  await requireAdmin()

  if (!fields.name || fields.name.trim().length === 0) {
    return { ok: false, error: 'Name is required' }
  }
  if (!Number.isFinite(fields.price) || fields.price < 0) {
    return { ok: false, error: 'Price must be a positive number' }
  }

  // Map UI status to isActive boolean (Product has no DRAFT/ARCHIVED enum in schema)
  const isActive = fields.status === 'ACTIVE'

  await prisma.product.update({
    where: { id: productId },
    data: {
      name: fields.name.trim(),
      price: roundToCent(fields.price),
      isActive,
      isFeatured: fields.isFeatured,
    },
  })

  revalidateProducts()
  return { ok: true }
}

// ============================================================
// 2. Bulk — Archive
// ============================================================

export async function bulkArchive(productIds: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(productIds)
  if (r) return r

  const result = await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: { isActive: false },
  })

  revalidateProducts()
  return { ok: true, affected: result.count }
}

// ============================================================
// 3. Bulk — Delete (SUPER_ADMIN only)
// ============================================================

export async function bulkDelete(productIds: string[]): Promise<BulkResult> {
  await requireAdminRole('SUPER_ADMIN')
  const r = rejectEmpty(productIds)
  if (r) return r

  try {
    const result = await prisma.product.deleteMany({
      where: { id: { in: productIds } },
    })
    revalidateProducts()
    return { ok: true, affected: result.count }
  } catch {
    // FK constraint (orders reference products) — fall back to deactivation
    const result = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { isActive: false },
    })
    revalidateProducts()
    return { ok: true, affected: result.count }
  }
}

// ============================================================
// 4. Bulk — Duplicate
// ============================================================

export async function bulkDuplicate(productIds: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(productIds)
  if (r) return r

  const originals = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { variants: true },
  })

  let count = 0
  for (const orig of originals) {
    const newSlug = `${orig.slug}-copy-${Date.now().toString(36)}`
    await prisma.product.create({
      data: {
        name: `${orig.name} (Copy)`,
        slug: newSlug,
        description: orig.description,
        price: orig.price,
        compareAtPrice: orig.compareAtPrice,
        categoryId: orig.categoryId,
        images: orig.images,
        materials: orig.materials,
        careGuide: orig.careGuide,
        isLimitedEdition: orig.isLimitedEdition,
        releaseDate: orig.releaseDate,
        dropEndDate: orig.dropEndDate,
        maxQuantity: orig.maxQuantity,
        isActive: false, // start as inactive draft
        isFeatured: false,
        isFeaturedNewArrival: false,
        costPrice: orig.costPrice,
        variants: {
          create: orig.variants.map((v) => ({
            sku: `${v.sku}-copy`,
            size: v.size,
            color: v.color,
            colorHex: v.colorHex,
            inventory: v.inventory,
            price: v.price,
            images: v.images,
            isActive: v.isActive,
            costPrice: v.costPrice,
          })),
        },
      },
    })
    count++
  }

  revalidateProducts()
  return { ok: true, affected: count }
}

// ============================================================
// 5. Bulk — Change category
// ============================================================

export async function bulkChangeCategory(
  productIds: string[],
  categoryId: string,
): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(productIds)
  if (r) return r
  if (!categoryId) return { ok: false, error: 'No category provided' }

  const result = await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: { categoryId },
  })

  revalidateProducts()
  return { ok: true, affected: result.count }
}

// ============================================================
// 6. Bulk — Price update
// ============================================================

export type PriceUpdateOp =
  | { mode: 'set'; value: number }
  | { mode: 'adjust-amount'; value: number }
  | { mode: 'adjust-pct'; value: number }

export async function bulkPriceUpdate(
  productIds: string[],
  op: PriceUpdateOp,
): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(productIds)
  if (r) return r
  if (!Number.isFinite(op.value)) return { ok: false, error: 'Invalid amount' }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, price: true },
  })

  let count = 0
  for (const p of products) {
    let newPrice = Number(p.price)
    if (op.mode === 'set') newPrice = op.value
    else if (op.mode === 'adjust-amount') newPrice = newPrice + op.value
    else if (op.mode === 'adjust-pct') newPrice = newPrice * (1 + op.value / 100)
    newPrice = Math.max(0, roundToCent(newPrice))

    await prisma.product.update({ where: { id: p.id }, data: { price: newPrice } })
    count++
  }

  revalidateProducts()
  return { ok: true, affected: count }
}

// ============================================================
// 7. Bulk — Add tag
//
// TODO: Product model has no tags field in the current schema.
// This action is stubbed. Add a String[] tags column to the Product model
// (or use a separate Tag/ProductTag table) to enable tag management.
// ============================================================

export async function bulkAddTag(productIds: string[], _tag: string): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(productIds)
  if (r) return r
  // TODO: Product.tags not in schema — this action is a no-op until tags are added
  return { ok: false, error: 'Tag management requires a tags field on Product (not yet in schema)' }
}

// ============================================================
// 8. Bulk — Set featured
// NOTE: schema field is Product.isFeatured (plan assumed .featured)
// ============================================================

export async function bulkSetFeatured(
  productIds: string[],
  featured: boolean,
): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(productIds)
  if (r) return r

  const result = await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: { isFeatured: featured },
  })

  revalidateProducts()
  return { ok: true, affected: result.count }
}

// ============================================================
// 9. Review — Approve
// ============================================================

export async function approveReview(reviewId: string): Promise<ActionResult> {
  await requireAdmin()
  await prisma.review.update({
    where: { id: reviewId },
    data: { status: 'APPROVED' },
  })
  revalidatePath('/admin/products')
  return { ok: true }
}

// ============================================================
// 10. Review — Reject
// ============================================================

export async function rejectReview(reviewId: string): Promise<ActionResult> {
  await requireAdmin()
  await prisma.review.update({
    where: { id: reviewId },
    data: { status: 'REJECTED' },
  })
  revalidatePath('/admin/products')
  return { ok: true }
}

// ============================================================
// 11. Review — Reply
//
// NOTE: ReviewReply model does NOT exist in the schema.
// Review has inline fields: adminReply (String?), adminReplyBy (String?),
// adminReplyAt (DateTime?). We update those inline fields.
//
// TODO: If a standalone ReviewReply model is added later, migrate to:
//   prisma.reviewReply.create({ data: { reviewId, body, authorName: 'Admin' } })
// ============================================================

export async function replyToReview(
  reviewId: string,
  body: string,
): Promise<ActionResult> {
  await requireAdmin()
  if (!body || body.trim().length === 0) {
    return { ok: false, error: 'Reply body is required' }
  }

  await prisma.review.update({
    where: { id: reviewId },
    data: {
      adminReply: body.trim(),
      adminReplyBy: 'Admin',
      adminReplyAt: new Date(),
    },
  })

  revalidatePath(`/admin/products/reviews/${reviewId}`)
  revalidatePath('/admin/products')
  return { ok: true }
}

// ============================================================
// 12. Collection — Reorder products
//
// NOTE: plan assumed junction model productOnCollections.position
//       actual: CollectionProduct.sortOrder
// ============================================================

export async function reorderCollectionProducts(
  collectionId: string,
  productIds: string[], // new desired order
): Promise<ActionResult> {
  await requireAdmin()

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < productIds.length; i++) {
      await (tx as typeof prisma).collectionProduct.updateMany({
        where: { collectionId, productId: productIds[i] },
        data: { sortOrder: i },
      })
    }
  })

  revalidatePath(`/admin/products/collections/${collectionId}`)
  revalidatePath('/admin/products')
  return { ok: true }
}

// ============================================================
// 13. Collection — Add products
//
// NOTE: junction = collectionProduct, ordering field = sortOrder
// ============================================================

export async function addProductsToCollection(
  collectionId: string,
  productIds: string[],
): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(productIds)
  if (r) return r

  // Determine next sortOrder value
  const current = await prisma.collectionProduct.findMany({
    where: { collectionId },
    select: { sortOrder: true },
    orderBy: { sortOrder: 'desc' },
    take: 1,
  })
  const startSort = (current[0]?.sortOrder ?? -1) + 1

  await prisma.collectionProduct.createMany({
    data: productIds.map((productId, i) => ({
      collectionId,
      productId,
      sortOrder: startSort + i,
    })),
    skipDuplicates: true,
  })

  revalidatePath(`/admin/products/collections/${collectionId}`)
  revalidatePath('/admin/products')
  return { ok: true, affected: productIds.length }
}

// ============================================================
// 14. Collection — Remove product
// ============================================================

export async function removeProductFromCollection(
  collectionId: string,
  productId: string,
): Promise<ActionResult> {
  await requireAdmin()

  await prisma.collectionProduct.deleteMany({
    where: { collectionId, productId },
  })

  revalidatePath(`/admin/products/collections/${collectionId}`)
  revalidatePath('/admin/products')
  return { ok: true }
}
