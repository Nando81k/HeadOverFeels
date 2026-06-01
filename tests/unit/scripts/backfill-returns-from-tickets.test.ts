// tests/unit/scripts/backfill-returns-from-tickets.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const findManyMock = vi.fn()
const createMock = vi.fn()
const transactionMock = vi.fn((fn: (tx: unknown) => unknown) =>
  fn({
    return: { create: createMock, findUnique: vi.fn().mockResolvedValue(null) },
    rmaCounter: { update: vi.fn().mockResolvedValue({ nextNumber: 100001 }) },
    $queryRaw: vi.fn().mockResolvedValue([{ nextNumber: 100000 }]),
  })
)

vi.mock('@/lib/prisma', () => ({
  prisma: {
    supportTicket: { findMany: findManyMock },
    return: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: transactionMock,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('backfillReturnsFromTickets', () => {
  it('creates a Return for each RETURN-type ticket with returnRequested=true', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 't1',
        type: 'RETURN',
        status: 'OPEN',
        customerId: 'c1',
        orderId: 'o1',
        refundAmount: 49.99,
        refundReason: 'Wrong size',
        returnRequested: true,
        returnApproved: null,
        returnLabel: null,
        createdAt: new Date('2026-05-01'),
      },
    ])
    createMock.mockResolvedValue({ id: 'r1', rmaNumber: 'RMA-100000' })

    const { backfillReturnsFromTickets } = await import('@/scripts/backfill-returns-from-tickets')
    const result = await backfillReturnsFromTickets({ dryRun: false })

    expect(result.created).toBe(1)
    expect(result.skipped).toBe(0)
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('skips tickets that already have a linked Return', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 't2',
        type: 'RETURN',
        status: 'CLOSED',
        customerId: 'c2',
        orderId: 'o2',
        refundAmount: 0,
        refundReason: null,
        returnRequested: true,
        returnApproved: true,
        returnLabel: 'http://example.com/label.pdf',
        createdAt: new Date('2026-05-02'),
      },
    ])
    transactionMock.mockImplementationOnce((fn: (tx: unknown) => unknown) =>
      fn({
        return: { create: createMock, findUnique: vi.fn().mockResolvedValue({ id: 'existing' }) },
        rmaCounter: { update: vi.fn() },
        $queryRaw: vi.fn(),
      })
    )

    const { backfillReturnsFromTickets } = await import('@/scripts/backfill-returns-from-tickets')
    const result = await backfillReturnsFromTickets({ dryRun: false })

    expect(result.created).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.skips[0].reason).toContain('linked Return already exists')
  })

  it('respects dryRun: true (no writes)', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 't3',
        type: 'REFUND',
        status: 'OPEN',
        customerId: 'c3',
        orderId: 'o3',
        refundAmount: 10,
        refundReason: 'Defect',
        returnRequested: true,
        returnApproved: null,
        returnLabel: null,
        createdAt: new Date('2026-05-03'),
      },
    ])

    const { backfillReturnsFromTickets } = await import('@/scripts/backfill-returns-from-tickets')
    const result = await backfillReturnsFromTickets({ dryRun: true })

    expect(result.created).toBe(1) // counts the intent
    expect(createMock).not.toHaveBeenCalled()
  })
})
