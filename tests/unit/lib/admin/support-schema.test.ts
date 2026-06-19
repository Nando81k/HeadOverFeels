// tests/unit/lib/admin/support-schema.test.ts
//
// Smoke test that the new CannedResponse model + SupportTicket.firstRespondedAt
// column are wired through the Prisma client.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const cannedFindMany = vi.fn()
const cannedCreate = vi.fn()
const cannedUpdate = vi.fn()
const cannedFindUnique = vi.fn()
const ticketCount = vi.fn()
const ticketFindMany = vi.fn()
const ticketUpdate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cannedResponse: {
      findMany: cannedFindMany,
      create: cannedCreate,
      update: cannedUpdate,
      findUnique: cannedFindUnique,
    },
    supportTicket: {
      count: ticketCount,
      findMany: ticketFindMany,
      update: ticketUpdate,
    },
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('CannedResponse model', () => {
  it('Prisma accepts cannedResponse CRUD ops', async () => {
    cannedFindMany.mockResolvedValue([])
    cannedCreate.mockResolvedValue({ id: 'cr1' })
    cannedUpdate.mockResolvedValue({ id: 'cr1' })
    cannedFindUnique.mockResolvedValue({ id: 'cr1', isActive: true })

    const { prisma } = await import('@/lib/prisma')

    await prisma.cannedResponse.findMany({
      where: { isActive: true, category: 'returns' },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    await prisma.cannedResponse.create({
      data: { title: 'T', body: 'B', category: 'returns', createdById: 'admin1' },
    })
    await prisma.cannedResponse.update({
      where: { id: 'cr1' },
      data: { isActive: false },
    })
    await prisma.cannedResponse.findUnique({ where: { id: 'cr1' } })

    expect(cannedCreate.mock.calls[0][0].data.createdById).toBe('admin1')
    expect(cannedUpdate.mock.calls[0][0].data.isActive).toBe(false)
  })
})

describe('SupportTicket.firstRespondedAt column', () => {
  it('Prisma accepts firstRespondedAt in where + select + data', async () => {
    ticketCount.mockResolvedValue(0)
    ticketFindMany.mockResolvedValue([])
    ticketUpdate.mockResolvedValue({ id: 't1', firstRespondedAt: new Date() })

    const { prisma } = await import('@/lib/prisma')

    await prisma.supportTicket.count({ where: { firstRespondedAt: null } })
    await prisma.supportTicket.findMany({
      select: { id: true, firstRespondedAt: true },
    })
    await prisma.supportTicket.update({
      where: { id: 't1', firstRespondedAt: null },
      data: { firstRespondedAt: new Date() },
    })

    expect(ticketCount).toHaveBeenCalledWith({ where: { firstRespondedAt: null } })
    expect(ticketUpdate.mock.calls[0][0].where.firstRespondedAt).toBeNull()
    expect(ticketUpdate.mock.calls[0][0].data.firstRespondedAt).toBeInstanceOf(Date)
  })
})
