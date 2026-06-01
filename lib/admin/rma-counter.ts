// lib/admin/rma-counter.ts
//
// Atomic RMA-NNNNNN sequence generator. Wraps a SELECT ... FOR UPDATE inside a
// $transaction so concurrent createReturn calls never produce duplicate numbers.

import { prisma } from '@/lib/prisma'

export async function getNextRmaNumber(): Promise<string> {
  return prisma.$transaction(async (tx) => {
    // Row-level lock — blocks other transactions that hit the same id.
    const rows = await tx.$queryRaw<{ nextNumber: number }[]>`
      SELECT "nextNumber" FROM "rma_counter" WHERE "id" = 'singleton' FOR UPDATE
    `
    const current = rows[0]?.nextNumber ?? 100000
    await tx.rmaCounter.update({
      where: { id: 'singleton' },
      data: { nextNumber: current + 1 },
    })
    return `RMA-${current.toString().padStart(6, '0')}`
  })
}
