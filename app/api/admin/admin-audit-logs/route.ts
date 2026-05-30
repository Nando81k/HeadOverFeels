import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/admin'
import { queryAuditLogs, AuditAction, AuditCategory } from '@/lib/audit'
import { z } from 'zod'

// Validation schema for admin audit log queries
const AdminAuditLogQuerySchema = z.object({
  adminId: z.string().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  category: z.nativeEnum(AuditCategory).optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

/**
 * GET /api/admin/admin-audit-logs
 * List all admin action audit logs with filtering and pagination
 * Requires admin authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const rawParams = {
      adminId: searchParams.get('adminId') || undefined,
      action: searchParams.get('action') || undefined,
      category: searchParams.get('category') || undefined,
      targetType: searchParams.get('targetType') || undefined,
      targetId: searchParams.get('targetId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50',
    }

    // Validate parameters
    const validationResult = AdminAuditLogQuerySchema.safeParse(rawParams)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const params = validationResult.data
    const offset = (params.page - 1) * params.limit

    // Query audit logs
    const { logs, total } = await queryAuditLogs({
      adminId: params.adminId,
      action: params.action,
      category: params.category,
      targetType: params.targetType,
      targetId: params.targetId,
      startDate: params.startDate ? new Date(params.startDate) : undefined,
      endDate: params.endDate ? new Date(params.endDate) : undefined,
      limit: params.limit,
      offset,
    })

    // Format response
    const formattedLogs = logs.map(log => ({
      id: log.id,
      admin: {
        id: log.admin?.id ?? log.adminId,
        name: log.adminName,
        email: log.adminEmail,
      },
      action: log.action,
      category: log.category,
      target: {
        id: log.targetId,
        type: log.targetType,
        label: log.targetLabel,
      },
      description: log.description,
      changes: log.changes ? JSON.parse(log.changes) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    }))

    return NextResponse.json({
      data: formattedLogs,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
        hasMore: offset + logs.length < total,
      },
      filters: {
        actions: Object.values(AuditAction),
        categories: Object.values(AuditCategory),
      },
    })
  } catch (error) {
    console.error('Admin audit logs fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin audit logs' },
      { status: 500 }
    )
  }
}
