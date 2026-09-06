import { NextRequest, NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/security/cron'
import { processEmailQueue } from '@/lib/email/queue'

/**
 * POST /api/cron/process-email-queue
 *
 * Drains the EmailQueue table, retrying any PENDING rows whose nextRetryAt
 * has elapsed.
 *
 * Not scheduled in vercel.json: the Vercel Hobby plan allows two daily crons,
 * so the scheduled sweep lives in /api/cron/run-all and first delivery
 * attempts happen inline from producers via `after()`. This route remains for
 * manual/ops triggers (sign with `generateCronSignature`).
 *
 * Security: HMAC-SHA256 signature verification (same pattern as other crons).
 * Include headers:
 *   x-cron-signature: HMAC-SHA256(timestamp:method, CRON_SECRET)
 *   x-cron-timestamp: current timestamp in milliseconds
 *
 * Returns: { processed, sent, failed }
 */
export async function POST(request: NextRequest) {
  const verificationError = verifyCronRequest(request)
  if (verificationError) {
    return verificationError
  }

  try {
    const result = await processEmailQueue(50)

    console.log(
      `[email-queue cron] processed=${result.processed} sent=${result.sent} failed=${result.failed}`
    )

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[email-queue cron] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process email queue',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
