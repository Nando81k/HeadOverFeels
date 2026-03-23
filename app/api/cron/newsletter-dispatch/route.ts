import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { processQueuedCampaigns } from '@/lib/newsletter/campaigns'
import {
  isNewsletterCampaignNotReadyError,
  NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE,
} from '@/lib/newsletter/campaign-delegate'

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback
  }
  return parsed
}

async function verifyCronSecret(): Promise<boolean> {
  const authHeader = (await headers()).get('authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) {
    console.error('CRON_SECRET environment variable is not set')
    return false
  }

  return authHeader === `Bearer ${expectedSecret}`
}

// POST /api/cron/newsletter-dispatch
// Queues are processed in bounded batches, designed to run every 2 minutes.
export async function POST(request: NextRequest) {
  const authorized = await verifyCronSecret()
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parsePositiveInt(searchParams.get('limit'), 3), 10)
    const staleWindowMinutes = parsePositiveInt(searchParams.get('staleWindowMinutes'), 20)

    const result = await processQueuedCampaigns({
      limit,
      staleWindowMs: staleWindowMinutes * 60 * 1000,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    if (isNewsletterCampaignNotReadyError(error)) {
      return NextResponse.json(
        { error: NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE },
        { status: 503 }
      )
    }

    console.error('Failed to process newsletter queue:', error)
    return NextResponse.json(
      { error: 'Failed to process newsletter queue' },
      { status: 500 }
    )
  }
}
