import { prisma } from '@/lib/prisma'
import { sendOrderConfirmation, sendShippingNotification } from '@/lib/email/resend'
import { EmailQueueStatus } from '@prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnqueueEmailParams {
  type: 'order-confirmation' | 'shipping-notification' | string
  recipient: string
  payload: Record<string, unknown>
}

export interface ProcessQueueResult {
  processed: number
  sent: number
  failed: number
}

// ---------------------------------------------------------------------------
// Sender map
// Maps queue `type` values to the corresponding Resend-backed send function.
// Each send function receives the stored payload cast to its expected params.
// ---------------------------------------------------------------------------

type SendFn = (params: Record<string, unknown>) => Promise<unknown>

const SENDER_MAP: Record<string, SendFn> = {
  'order-confirmation': (payload) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendOrderConfirmation(payload as any),
  'shipping-notification': (payload) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendShippingNotification(payload as any),
}

// ---------------------------------------------------------------------------
// Backoff helper
// Exponential backoff, base 60 s, capped at 1 hour.
// attempts=0 → 60 s, attempts=1 → 120 s, attempts=2 → 240 s … max 3600 s.
// ---------------------------------------------------------------------------

function backoffMs(attempts: number): number {
  return Math.min(60 * 2 ** attempts, 3600) * 1000
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enqueue an email for durable delivery.
 * Returns immediately after writing the queue row — no Resend call is made.
 */
export async function enqueueEmail(
  params: EnqueueEmailParams
): Promise<{ id: string }> {
  const row = await prisma.emailQueue.create({
    data: {
      type: params.type,
      recipient: params.recipient,
      // Prisma Json field requires a compatible type; cast via unknown
      payload: params.payload as unknown as import('@prisma/client').Prisma.InputJsonValue,
      // status / attempts / nextRetryAt get Prisma defaults (PENDING / 0 / now)
    },
    select: { id: true },
  })

  return { id: row.id }
}

/**
 * Drain up to `limit` pending queue rows.
 *
 * Concurrency note: each row is updated atomically before the send attempt
 * (soft lease via nextRetryAt advancement). This prevents a second concurrent
 * cron run from claiming the same row in the time window between selection and
 * update. Because Vercel Cron only triggers a single invocation every 5 min
 * and processEmailQueue finishes well within that window, this pattern is safe
 * for Wave 3A. A database-level advisory lock or SELECT … FOR UPDATE SKIP LOCKED
 * would be required if concurrent runners were expected.
 */
export async function processEmailQueue(
  limit = 50
): Promise<ProcessQueueResult> {
  const now = new Date()

  // Select eligible rows
  const rows = await prisma.emailQueue.findMany({
    where: {
      status: EmailQueueStatus.PENDING,
      nextRetryAt: { lte: now },
    },
    orderBy: { nextRetryAt: 'asc' },
    take: limit,
  })

  let sent = 0
  let failed = 0

  for (const row of rows) {
    // Soft lease: push nextRetryAt forward so a concurrent runner skips this row
    const leaseExpiry = new Date(Date.now() + 5 * 60 * 1000)
    await prisma.emailQueue.update({
      where: { id: row.id },
      data: { nextRetryAt: leaseExpiry },
    })

    const sender = SENDER_MAP[row.type]

    if (!sender) {
      // Unknown type — exhaust retries immediately so the row doesn't loop forever
      await prisma.emailQueue.update({
        where: { id: row.id },
        data: {
          status: EmailQueueStatus.FAILED,
          lastError: `No sender registered for type "${row.type}"`,
          attempts: row.attempts + 1,
        },
      })
      failed++
      continue
    }

    try {
      const payload = row.payload as Record<string, unknown>
      // Merge recipient into payload so callers don't have to duplicate it
      if (!payload.to) {
        payload.to = row.recipient
      }
      await sender(payload)

      await prisma.emailQueue.update({
        where: { id: row.id },
        data: {
          status: EmailQueueStatus.SENT,
          sentAt: new Date(),
          lastError: null,
        },
      })
      sent++
    } catch (err) {
      const newAttempts = row.attempts + 1
      const errorMessage =
        err instanceof Error ? err.message : String(err)

      if (newAttempts >= row.maxAttempts) {
        await prisma.emailQueue.update({
          where: { id: row.id },
          data: {
            status: EmailQueueStatus.FAILED,
            attempts: newAttempts,
            lastError: errorMessage,
          },
        })
        failed++
      } else {
        // Schedule next retry with exponential backoff
        const nextRetry = new Date(Date.now() + backoffMs(newAttempts))
        await prisma.emailQueue.update({
          where: { id: row.id },
          data: {
            attempts: newAttempts,
            nextRetryAt: nextRetry,
            lastError: errorMessage,
          },
        })
      }
    }
  }

  return { processed: rows.length, sent, failed }
}
