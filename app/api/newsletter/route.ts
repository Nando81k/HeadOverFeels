import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from '@/lib/newsletter/subscribers'
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitResponse,
} from '@/lib/security/rateLimit'

const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  source: z.string().optional(),
  sourceDetails: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  honeypot: z.string().optional(),
})

const unsubscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  reason: z.string().optional(),
})

const unsubscribeQuerySchema = z.object({
  email: z.string().email('Invalid email address'),
  reason: z.string().optional(),
})

const NEWSLETTER_RATE_LIMITS = {
  perIp: {
    maxRequests: 15,
    windowMs: 60 * 1000,
  },
  perEmail: {
    maxRequests: 3,
    windowMs: 5 * 60 * 1000,
  },
}

// POST - Subscribe to newsletter
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = subscribeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    const {
      email,
      source,
      sourceDetails,
      utmSource,
      utmMedium,
      utmCampaign,
      honeypot,
    } = parsed.data

    // Invisible anti-bot field. Return success without persisting.
    if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Thanks for subscribing! You\'re on the list.',
      })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const clientIdentifier = getClientIdentifier(request.headers)

    const ipRateLimit = await checkRateLimit(
      `newsletter:ip:${clientIdentifier}`,
      NEWSLETTER_RATE_LIMITS.perIp.maxRequests,
      NEWSLETTER_RATE_LIMITS.perIp.windowMs
    )
    if (!ipRateLimit.allowed) {
      return rateLimitResponse(ipRateLimit.retryAfter)
    }

    const emailRateLimit = await checkRateLimit(
      `newsletter:email:${normalizedEmail}`,
      NEWSLETTER_RATE_LIMITS.perEmail.maxRequests,
      NEWSLETTER_RATE_LIMITS.perEmail.windowMs
    )
    if (!emailRateLimit.allowed) {
      return rateLimitResponse(emailRateLimit.retryAfter)
    }

    const result = await subscribeToNewsletter({
      email: normalizedEmail,
      source,
      sourceDetails,
      utmSource,
      utmMedium,
      utmCampaign,
    })

    const message = result.alreadySubscribed
      ? 'You\'re already subscribed to our newsletter!'
      : result.reactivated
        ? 'Welcome back! You\'ve been resubscribed to our newsletter.'
        : 'Thanks for subscribing! You\'re on the list.'

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error) {
    console.error('Newsletter subscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to subscribe. Please try again.' },
      { status: 500 }
    )
  }
}

// DELETE - Unsubscribe from newsletter
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, reason } = unsubscribeSchema.parse(body)

    await unsubscribeFromNewsletter({
      email,
      reason,
      source: 'api_delete',
    })

    return NextResponse.json({
      success: true,
      message: 'You\'ve been unsubscribed from our newsletter.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }
    console.error('Newsletter unsubscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to unsubscribe. Please try again.' },
      { status: 500 }
    )
  }
}

// GET - One-click unsubscribe link for email footer compliance
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { email, reason } = unsubscribeQuerySchema.parse({
      email: searchParams.get('email'),
      reason: searchParams.get('reason') || undefined,
    })

    await unsubscribeFromNewsletter({
      email,
      reason,
      source: 'email_unsubscribe_link',
    })

    const safeEmail = email
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Unsubscribed</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;color:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:48px auto;padding:24px;background:#fff;border:1px solid #e5e5e5;">
      <p style="margin:0 0 10px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.16em;color:#666;">Head Over Feels</p>
      <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.2;">You have been unsubscribed</h1>
      <p style="margin:0;color:#444;line-height:1.6;">You will no longer receive newsletter emails at <strong>${safeEmail}</strong>.</p>
    </div>
  </body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid unsubscribe link' },
        { status: 400 }
      )
    }

    console.error('Newsletter one-click unsubscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to unsubscribe. Please try again.' },
      { status: 500 }
    )
  }
}
