import { NextRequest, NextResponse } from 'next/server'
import { markAsRead } from '@/lib/notifications/service'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/notifications/[id] - Mark single notification as read
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const sessionId = request.cookies.get('auth_session')?.value
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const success = await markAsRead(id, sessionId)

    if (!success) {
      return NextResponse.json(
        { error: 'Notification not found or already read' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}
