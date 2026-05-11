import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { markAsRead } from '@/lib/notifications/service'
import { auth } from '@/lib/auth/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function resolveCustomerId(request: NextRequest): Promise<string | null> {
  const session = await auth()
  if (session?.user?.id) return session.user.id
  return request.cookies.get('auth_session')?.value ?? null
}

// PATCH /api/notifications/[id] - Mark single notification as read
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const customerId = await resolveCustomerId(request)
    if (!customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const success = await markAsRead(id, customerId)

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

// DELETE /api/notifications/[id] - Dismiss (delete) a notification
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const customerId = await resolveCustomerId(request)
    if (!customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    // deleteMany with the customerId guard ensures customers can only delete
    // their own notifications, even if they guess another id.
    const result = await prisma.customerNotification.deleteMany({
      where: { id, customerId },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    )
  }
}
