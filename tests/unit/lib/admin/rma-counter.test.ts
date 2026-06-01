// tests/unit/lib/admin/rma-counter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => {
  const tx = {
    $queryRaw: vi.fn(),
    rmaCounter: {
      update: vi.fn(),
    },
  }
  // Serialize transactions so SELECT FOR UPDATE behaviour is correctly simulated:
  // concurrent callers queue up and each waits for the previous to commit.
  let queue = Promise.resolve()
  return {
    prisma: {
      $transaction: vi.fn((fn: (t: typeof tx) => unknown) => {
        const next = queue.then(() => fn(tx) as Promise<unknown>)
        queue = next.catch(() => undefined)
        return next
      }),
      __tx: tx,
    },
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getNextRmaNumber', () => {
  it('returns sequential RMA-NNNNNN strings under contention', async () => {
    const { prisma } = await import('@/lib/prisma') as unknown as {
      prisma: { __tx: { $queryRaw: ReturnType<typeof vi.fn>; rmaCounter: { update: ReturnType<typeof vi.fn> } } }
    }
    let n = 100000
    // Simulate SELECT FOR UPDATE serialising concurrent reads: each call sees
    // the value that the previous transaction committed, so n advances per call.
    prisma.__tx.$queryRaw.mockImplementation(() => {
      const val = n
      return Promise.resolve([{ nextNumber: val }])
    })
    prisma.__tx.rmaCounter.update.mockImplementation(() => {
      n += 1
      return Promise.resolve({ id: 'singleton', nextNumber: n })
    })

    const { getNextRmaNumber } = await import('@/lib/admin/rma-counter')
    const results = await Promise.all([
      getNextRmaNumber(),
      getNextRmaNumber(),
      getNextRmaNumber(),
    ])
    expect(results).toEqual(['RMA-100000', 'RMA-100001', 'RMA-100002'])
  })

  it('uses SELECT ... FOR UPDATE inside transaction', async () => {
    const { prisma } = await import('@/lib/prisma') as unknown as {
      prisma: { __tx: { $queryRaw: ReturnType<typeof vi.fn>; rmaCounter: { update: ReturnType<typeof vi.fn> } } }
    }
    prisma.__tx.$queryRaw.mockResolvedValue([{ nextNumber: 100000 }])
    prisma.__tx.rmaCounter.update.mockResolvedValue({ id: 'singleton', nextNumber: 100001 })

    const { getNextRmaNumber } = await import('@/lib/admin/rma-counter')
    await getNextRmaNumber()
    const first = prisma.__tx.$queryRaw.mock.calls[0][0]
    const sql = Array.isArray(first) ? first.join('') : String(first)
    expect(sql.toUpperCase()).toContain('FOR UPDATE')
  })
})
