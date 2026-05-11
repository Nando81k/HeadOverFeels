import { NextRequest, NextResponse } from 'next/server'
import { NotificationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
} from '@/lib/notifications/service'
import { auth } from '@/lib/auth/auth'

// Mirrors the auth resolution in /api/auth/me — try NextAuth session first
// (works for OAuth users on first paint, before /api/auth/me has set the
// auth_session cookie), then fall back to the cookie set by the legacy
// email/password flow.
async function resolveCustomerId(request: NextRequest): Promise<string | null> {
  const session = await auth()
  if (session?.user?.id) return session.user.id
  return request.cookies.get('auth_session')?.value ?? null
}

// Optional `?types=ORDER_CONFIRMED,ORDER_SHIPPED` filter for the inbox tabs.
function parseTypesParam(raw: string | null): NotificationType[] | undefined {
  if (!raw) return undefined
  const validTypes = new Set(Object.values(NotificationType))
  const parsed = raw
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter((t): t is NotificationType => validTypes.has(t as NotificationType))
  return parsed.length > 0 ? parsed : undefined
}

// GET /api/notifications - Get customer notifications
export async function GET(request: NextRequest) {
  try {
    const customerId = await resolveCustomerId(request)
    if (!customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const countOnly = searchParams.get('countOnly') === 'true'
    const types = parseTypesParam(searchParams.get('types'))

    if (countOnly) {
      const count = await getUnreadCount(customerId)
      return NextResponse.json({ unreadCount: count })
    }

    const result = await getNotifications(customerId, {
      unreadOnly,
      limit: Math.min(limit, 50),
      offset,
      types,
    })

    const unreadCount = await getUnreadCount(customerId)

    return NextResponse.json({
      ...result,
      unreadCount,
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// POST /api/notifications - Bulk actions: markAllRead, clearRead
export async function POST(request: NextRequest) {
  try {
    const customerId = await resolveCustomerId(request)
    if (!customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { action } = body

    if (action === 'markAllRead') {
      const count = await markAllAsRead(customerId)
      return NextResponse.json({ success: true, markedCount: count })
    }

    if (action === 'clearRead') {
      const result = await prisma.customerNotification.deleteMany({
        where: { customerId, isRead: true },
      })
      return NextResponse.json({ success: true, deletedCount: result.count })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating notifications:', error)
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}
