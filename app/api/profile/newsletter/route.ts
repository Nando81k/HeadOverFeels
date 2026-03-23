import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth/auth'
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from '@/lib/newsletter/subscribers'

const updateNewsletterSchema = z.object({
  subscribed: z.boolean(),
})

const CANONICAL_CUSTOMER_ORDER = [
  { totalOrders: 'desc' as const },
  { lifetimePoints: 'desc' as const },
  { currentPoints: 'desc' as const },
  { createdAt: 'asc' as const },
]

async function getAuthenticatedCustomer(request: NextRequest) {
  const session = await auth()
  const authSessionCookie = request.cookies.get('auth_session')?.value
  const userId = session?.user?.id || authSessionCookie || null

  if (!userId) {
    return null
  }

  const baseCustomer = await prisma.customer.findUnique({
    where: { id: userId },
    select: { email: true },
  })

  const referenceEmail =
    session?.user?.email?.toLowerCase().trim() ||
    baseCustomer?.email.toLowerCase().trim() ||
    null

  if (!referenceEmail) {
    return null
  }

  return prisma.customer.findFirst({
    where: {
      email: {
        equals: referenceEmail,
        mode: 'insensitive',
      },
    },
    orderBy: CANONICAL_CUSTOMER_ORDER,
    select: {
      id: true,
      email: true,
      newsletter: true,
    },
  })
}

// GET /api/profile/newsletter - current subscription state for authenticated user
export async function GET(request: NextRequest) {
  try {
    const customer = await getAuthenticatedCustomer(request)
    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      subscribed: customer.newsletter,
    })
  } catch (error) {
    console.error('Failed to fetch profile newsletter status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch newsletter status' },
      { status: 500 }
    )
  }
}

// PUT /api/profile/newsletter - update subscription state for authenticated user
export async function PUT(request: NextRequest) {
  try {
    const customer = await getAuthenticatedCustomer(request)
    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = updateNewsletterSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      )
    }

    if (parsed.data.subscribed) {
      await subscribeToNewsletter({
        email: customer.email,
        source: 'profile_notifications',
        sourceDetails: 'profile_newsletter_toggle',
      })
    } else {
      await unsubscribeFromNewsletter({
        email: customer.email,
        source: 'profile_notifications',
        reason: 'profile_newsletter_toggle',
      })
    }

    const refreshed = await prisma.customer.findUnique({
      where: { id: customer.id },
      select: { newsletter: true },
    })

    return NextResponse.json({
      success: true,
      subscribed: refreshed?.newsletter ?? parsed.data.subscribed,
    })
  } catch (error) {
    console.error('Failed to update profile newsletter status:', error)
    return NextResponse.json(
      { error: 'Failed to update newsletter status' },
      { status: 500 }
    )
  }
}
