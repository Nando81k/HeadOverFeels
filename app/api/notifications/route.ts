import { NextRequest, NextResponse } from 'next/server'
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
} from '@/lib/notifications/service'

// GET /api/notifications - Get customer notifications
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('auth_session')?.value
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const countOnly = searchParams.get('countOnly') === 'true'

    // If only count is requested, return just the count
    if (countOnly) {
      const count = await getUnreadCount(sessionId)
      return NextResponse.json({ unreadCount: count })
    }

    const result = await getNotifications(sessionId, {
      unreadOnly,
      limit: Math.min(limit, 50), // Cap at 50
      offset,
    })

    // Also include unread count
    const unreadCount = await getUnreadCount(sessionId)

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

// POST /api/notifications - Mark all as read
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('auth_session')?.value
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'markAllRead') {
      const count = await markAllAsRead(sessionId)
      return NextResponse.json({ success: true, markedCount: count })
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
