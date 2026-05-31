// tests/unit/app/admin/products/actions.test.ts
// Phase 3 Task 3 — server actions test suite
//
// Schema adaptations vs. plan:
//   - Product.isFeatured (not .featured)   → bulkSetFeatured / saveProductQuickEdit use { isFeatured }
//   - ReviewReply model absent             → replyToReview updates Review.adminReply inline
//   - Junction: collectionProduct.sortOrder → reorderCollectionProducts / addProductsToCollection use prisma.collectionProduct
//   - requireAdmin / requireAdminRole are server-action-compatible wrappers in lib/auth/admin

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    review: { update: vi.fn() },
    collectionProduct: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        collectionProduct: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      }
      return cb(tx)
    }),
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn(async () => 'admin-id'),
  requireAdminRole: vi.fn(async () => 'admin-id'),
}))

import {
  bulkSetFeatured,
  saveProductQuickEdit,
  bulkArchive,
  bulkDelete,
  approveReview,
  rejectReview,
  replyToReview,
  reorderCollectionProducts,
  addProductsToCollection,
  removeProductFromCollection,
} from '@/app/admin/products/actions'
import { prisma } from '@/lib/prisma'

beforeEach(() => {
  vi.mocked(prisma.product.updateMany).mockReset().mockResolvedValue({ count: 2 } as any)
  vi.mocked(prisma.product.update).mockReset().mockResolvedValue({} as any)
  vi.mocked(prisma.product.findMany).mockReset().mockResolvedValue([])
  vi.mocked(prisma.review.update).mockReset().mockResolvedValue({} as any)
  vi.mocked(prisma.collectionProduct.findMany).mockReset().mockResolvedValue([])
  vi.mocked(prisma.collectionProduct.createMany).mockReset().mockResolvedValue({ count: 2 } as any)
  vi.mocked(prisma.collectionProduct.deleteMany).mockReset().mockResolvedValue({ count: 1 } as any)
})

// ============================================================
// bulkSetFeatured
// NOTE: schema uses Product.isFeatured (not .featured)
// ============================================================

describe('bulkSetFeatured', () => {
  it('updates many products with isFeatured value', async () => {
    const r = await bulkSetFeatured(['p1', 'p2'], true)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1', 'p2'] } },
      data: { isFeatured: true },
    })
  })

  it('rejects empty selection', async () => {
    const r = await bulkSetFeatured([], true)
    expect(r.ok).toBe(false)
  })
})

// ============================================================
// saveProductQuickEdit
// NOTE: uses isFeatured (not featured) per schema
// ============================================================

describe('saveProductQuickEdit', () => {
  it('validates and updates a single product', async () => {
    const r = await saveProductQuickEdit('p1', {
      name: 'New',
      price: 100,
      status: 'ACTIVE',
      isFeatured: false,
    })
    expect(r.ok).toBe(true)
    expect(prisma.product.update).toHaveBeenCalled()
  })

  it('rejects negative price', async () => {
    const r = await saveProductQuickEdit('p1', {
      name: 'X',
      price: -1,
      status: 'ACTIVE',
      isFeatured: false,
    })
    expect(r.ok).toBe(false)
  })
})

// ============================================================
// bulkArchive
// ============================================================

describe('bulkArchive', () => {
  it('archives selected products by setting isActive=false', async () => {
    const r = await bulkArchive(['p1', 'p2'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1', 'p2'] } },
      data: { isActive: false },
    })
  })

  it('rejects empty selection', async () => {
    const r = await bulkArchive([])
    expect(r.ok).toBe(false)
  })
})

// ============================================================
// bulkDelete
// ============================================================

describe('bulkDelete', () => {
  it('returns ok when deleteMany succeeds', async () => {
    vi.mocked(prisma.product.deleteMany).mockResolvedValue({ count: 1 } as any)
    const r = await bulkDelete(['p1'])
    expect(r.ok).toBe(true)
  })
})

// ============================================================
// approveReview / rejectReview
// ============================================================

describe('approveReview', () => {
  it('sets review status to APPROVED', async () => {
    const r = await approveReview('r1')
    expect(r.ok).toBe(true)
    expect(prisma.review.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'APPROVED' },
    })
  })
})

describe('rejectReview', () => {
  it('sets review status to REJECTED', async () => {
    const r = await rejectReview('r1')
    expect(r.ok).toBe(true)
    expect(prisma.review.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'REJECTED' },
    })
  })
})

// ============================================================
// replyToReview
// NOTE: ReviewReply model absent — uses Review.adminReply inline fields
// ============================================================

describe('replyToReview', () => {
  it('stores reply inline on the review record', async () => {
    const r = await replyToReview('r1', 'Great product!')
    expect(r.ok).toBe(true)
    expect(prisma.review.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({ adminReply: 'Great product!' }),
      }),
    )
  })

  it('rejects empty reply body', async () => {
    const r = await replyToReview('r1', '  ')
    expect(r.ok).toBe(false)
  })
})

// ============================================================
// Collection actions
// NOTE: junction model = collectionProduct, ordering field = sortOrder
// ============================================================

describe('reorderCollectionProducts', () => {
  it('returns ok', async () => {
    const r = await reorderCollectionProducts('c1', ['p1', 'p2'])
    expect(r.ok).toBe(true)
  })
})

describe('addProductsToCollection', () => {
  it('creates junction rows and returns affected count', async () => {
    vi.mocked(prisma.collectionProduct.findMany).mockResolvedValue([])
    const r = await addProductsToCollection('c1', ['p1', 'p2'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
    expect(prisma.collectionProduct.createMany).toHaveBeenCalled()
  })

  it('rejects empty product list', async () => {
    const r = await addProductsToCollection('c1', [])
    expect(r.ok).toBe(false)
  })
})

describe('removeProductFromCollection', () => {
  it('deletes junction row and returns ok', async () => {
    const r = await removeProductFromCollection('c1', 'p1')
    expect(r.ok).toBe(true)
    expect(prisma.collectionProduct.deleteMany).toHaveBeenCalledWith({
      where: { collectionId: 'c1', productId: 'p1' },
    })
  })
})
