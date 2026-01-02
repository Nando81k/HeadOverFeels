import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/prisma'
import { 
  executeConfirmedAction, 
  rejectPendingAction,
  AdminContext 
} from '@/lib/ai/agents/admin-agent'

/**
 * Admin Action Confirmation API
 * 
 * Allows admins to confirm or reject pending destructive actions.
 */

export async function POST(request: NextRequest) {
  try {
    // Verify admin session
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const admin = await prisma.adminUser.findUnique({
      where: { email: session.user.email },
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { pendingActionId, action, currentPage = '/admin' } = body

    if (!pendingActionId || !action) {
      return NextResponse.json(
        { error: 'pendingActionId and action are required' },
        { status: 400 }
      )
    }

    if (!['confirm', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "confirm" or "reject"' },
        { status: 400 }
      )
    }

    // Verify the pending action exists and belongs to admin's conversation
    const pendingAction = await prisma.aiPendingAction.findUnique({
      where: { id: pendingActionId },
      include: { conversation: true },
    })

    if (!pendingAction) {
      return NextResponse.json(
        { error: 'Pending action not found' },
        { status: 404 }
      )
    }

    if (pendingAction.conversation?.adminId !== admin.id) {
      return NextResponse.json(
        { error: 'Unauthorized to manage this action' },
        { status: 403 }
      )
    }

    // Build admin context for execution
    const context: AdminContext = {
      adminId: admin.id,
      adminName: admin.name,
      adminEmail: admin.email,
      currentPage,
    }

    if (action === 'confirm') {
      const result = await executeConfirmedAction(pendingActionId, context)
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to execute action' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Action executed successfully',
        result: result.result,
      })
    } else {
      await rejectPendingAction(pendingActionId)
      
      return NextResponse.json({
        success: true,
        message: 'Action rejected',
      })
    }
  } catch (error) {
    console.error('Confirm action error:', error)
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    )
  }
}

/**
 * Get pending actions for admin
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const admin = await prisma.adminUser.findUnique({
      where: { email: session.user.email },
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')

    const where: Record<string, unknown> = {
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    }

    if (conversationId) {
      where.conversationId = conversationId
    } else {
      // Get all pending actions for admin's conversations
      where.conversation = { adminId: admin.id }
    }

    const pendingActions = await prisma.aiPendingAction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        conversation: {
          select: { title: true },
        },
      },
    })

    return NextResponse.json({
      pendingActions: pendingActions.map(pa => ({
        id: pa.id,
        actionType: pa.actionType,
        payload: JSON.parse(pa.actionPayload),
        status: pa.status,
        expiresAt: pa.expiresAt,
        createdAt: pa.createdAt,
        conversationTitle: pa.conversation?.title,
      })),
    })
  } catch (error) {
    console.error('Get pending actions error:', error)
    return NextResponse.json(
      { error: 'Failed to load pending actions' },
      { status: 500 }
    )
  }
}
