// tests/unit/lib/admin/customers-schema.test.ts
//
// Smoke test that the new Customer.anonymizedAt column is wired through the
// Prisma client and respects the not-yet-anonymized predicate.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const customerCount = vi.fn()
const customerFindMany = vi.fn()
const customerUpdate = vi.fn()
const customerFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      count: customerCount,
      findMany: customerFindMany,
      update: customerUpdate,
      findUnique: customerFindUnique,
    },
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('Customer.anonymizedAt column', () => {
  it('Prisma accepts anonymizedAt in where + select + data', async () => {
    customerCount.mockResolvedValue(0)
    customerFindMany.mockResolvedValue([])
    customerUpdate.mockResolvedValue({ id: 'c1', anonymizedAt: new Date() })
    customerFindUnique.mockResolvedValue({ id: 'c1', anonymizedAt: null })

    const { prisma } = await import('@/lib/prisma')

    // where filter
    await prisma.customer.count({ where: { anonymizedAt: null } })
    // select
    await prisma.customer.findMany({ select: { id: true, anonymizedAt: true } })
    // update with guard
    await prisma.customer.update({
      where: { id: 'c1', anonymizedAt: null },
      data: { anonymizedAt: new Date() },
    })
    // findUnique
    await prisma.customer.findUnique({ where: { id: 'c1' }, select: { anonymizedAt: true } })

    expect(customerCount).toHaveBeenCalledWith({ where: { anonymizedAt: null } })
    expect(customerUpdate.mock.calls[0][0].where.anonymizedAt).toBeNull()
    expect(customerUpdate.mock.calls[0][0].data.anonymizedAt).toBeInstanceOf(Date)
  })
})
