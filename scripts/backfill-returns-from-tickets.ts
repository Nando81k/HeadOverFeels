// scripts/backfill-returns-from-tickets.ts
//
// Idempotent backfill: for each SupportTicket with type IN (RETURN, REFUND, EXCHANGE)
// AND returnRequested = true, create a corresponding Return row with rmaNumber from
// the RmaCounter. Skips tickets that already have a linked Return (by supportTicketId).
//
// Run with:
//   pnpm tsx scripts/backfill-returns-from-tickets.ts            # live
//   pnpm tsx scripts/backfill-returns-from-tickets.ts --dry-run  # dry run

import { prisma } from '@/lib/prisma'

interface BackfillSkip {
  ticketId: string
  reason: string
}

export interface BackfillResult {
  created: number
  skipped: number
  skips: BackfillSkip[]
}

function deriveStatus(returnApproved: boolean | null, ticketStatus: string): 'REQUESTED' | 'APPROVED' | 'REJECTED' {
  if (returnApproved === true) return 'APPROVED'
  if (returnApproved === false) return 'REJECTED'
  if (ticketStatus === 'CLOSED') return 'REJECTED'
  return 'REQUESTED'
}

export async function backfillReturnsFromTickets(
  options: { dryRun?: boolean } = {}
): Promise<BackfillResult> {
  const dryRun = options.dryRun ?? false

  const tickets = await prisma.supportTicket.findMany({
    where: {
      type: { in: ['RETURN', 'REFUND', 'EXCHANGE'] },
      returnRequested: true,
    },
    select: {
      id: true,
      type: true,
      status: true,
      customerId: true,
      orderId: true,
      refundAmount: true,
      refundReason: true,
      returnRequested: true,
      returnApproved: true,
      returnLabel: true,
      createdAt: true,
    },
  })

  const skips: BackfillSkip[] = []
  let created = 0

  for (const t of tickets) {
    if (!t.orderId) {
      skips.push({ ticketId: t.id, reason: 'no orderId on ticket' })
      continue
    }

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.return.findUnique({ where: { supportTicketId: t.id } })
        if (existing) {
          skips.push({ ticketId: t.id, reason: 'linked Return already exists' })
          return
        }

        if (dryRun) {
          created += 1
          return
        }

        // Inline RMA generation (we can't share the lib helper here because we're
        // already inside a transaction).
        const rows = await tx.$queryRaw<{ nextNumber: number }[]>`
          SELECT "nextNumber" FROM "rma_counter" WHERE "id" = 'singleton' FOR UPDATE
        `
        const current = rows[0]?.nextNumber ?? 100000
        await tx.rmaCounter.update({
          where: { id: 'singleton' },
          data: { nextNumber: current + 1 },
        })
        const rmaNumber = `RMA-${current.toString().padStart(6, '0')}`

        const windowExpiresAt = new Date(t.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000)

        await tx.return.create({
          data: {
            rmaNumber,
            orderId: t.orderId!,
            customerId: t.customerId,
            status: deriveStatus(t.returnApproved, t.status),
            reason: t.refundReason ?? 'Backfilled from support ticket',
            returnLabel: t.returnLabel,
            windowExpiresAt,
            requestedAt: t.createdAt,
            supportTicketId: t.id,
          },
        })
        created += 1
      })
    } catch (err) {
      skips.push({
        ticketId: t.id,
        reason: err instanceof Error ? err.message : 'unknown error',
      })
    }
  }

  return { created, skipped: skips.length, skips }
}

// CLI entrypoint
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run')
  backfillReturnsFromTickets({ dryRun })
    .then((res) => {
      console.log(JSON.stringify(res, null, 2))
      process.exit(0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
