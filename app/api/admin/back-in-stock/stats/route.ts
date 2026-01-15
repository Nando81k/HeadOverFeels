/**
 * Admin Back-in-Stock Stats API
 * 
 * GET /api/admin/back-in-stock/stats - Get notification statistics
 * POST /api/admin/back-in-stock/cleanup - Clean up expired notifications
 * POST /api/admin/back-in-stock/trigger - Manually trigger notifications for a product
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { 
  getNotificationStats,
  cleanupExpiredNotifications,
  triggerBackInStockNotifications
} from '@/lib/back-in-stock'

// Check admin access
async function checkAdmin() {
  const session = await auth()
  if (!session?.user?.isAdmin) {
    return false
  }
  return true
}

// GET: Get notification statistics
export async function GET() {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stats = await getNotificationStats()

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get statistics' },
      { status: 500 }
    )
  }
}

// POST: Cleanup expired or manually trigger notifications
export async function POST(req: NextRequest) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, productId, variantId } = body

    switch (action) {
      case 'cleanup': {
        const expiredCount = await cleanupExpiredNotifications()
        return NextResponse.json({
          success: true,
          data: { 
            expiredCount,
            message: `Cleaned up ${expiredCount} expired notifications`,
          },
        })
      }

      case 'trigger': {
        if (!productId) {
          return NextResponse.json(
            { error: 'productId is required for trigger action' },
            { status: 400 }
          )
        }

        const result = await triggerBackInStockNotifications(productId, variantId)
        return NextResponse.json({
          success: true,
          data: {
            notificationCount: result.notificationCount,
            message: `Triggered ${result.notificationCount} notifications`,
          },
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "cleanup" or "trigger"' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Admin action error:', error)
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    )
  }
}
