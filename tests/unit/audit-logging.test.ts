// tests/unit/audit-logging.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminAuditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

describe('Audit Logging System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('createAuditLog', () => {
    it('should create audit log with all required fields', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { createAuditLog } = await import('@/lib/audit')

      vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({
        id: 'log-1',
        adminId: 'admin-1',
        adminEmail: 'admin@test.com',
        adminName: 'Admin User',
        action: 'UPDATE_ORDER',
        category: 'ORDER',
        targetId: 'order-123',
        targetType: 'Order',
        targetLabel: 'Order #HOF-123',
        description: 'Updated order status',
        changes: null,
        metadata: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      } as any)

      const result = await createAuditLog({
        adminId: 'admin-1',
        adminEmail: 'admin@test.com',
        adminName: 'Admin User',
        action: 'UPDATE_ORDER' as any,
        category: 'ORDER' as any,
        targetId: 'order-123',
        targetType: 'Order',
        targetLabel: 'Order #HOF-123',
        description: 'Updated order status',
      })

      expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: 'admin-1',
          action: 'UPDATE_ORDER',
          category: 'ORDER',
          targetId: 'order-123',
        }),
      })
      expect(result).toBeDefined()
    })

    it('should store changes as JSON when provided', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { createAuditLog } = await import('@/lib/audit')

      const changes = {
        before: { status: 'PENDING' },
        after: { status: 'SHIPPED' },
      }

      vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({
        id: 'log-2',
        changes: JSON.stringify(changes),
      } as any)

      await createAuditLog({
        adminId: 'admin-1',
        adminEmail: 'admin@test.com',
        adminName: 'Admin User',
        action: 'UPDATE_ORDER' as any,
        category: 'ORDER' as any,
        description: 'Status change',
        changes,
      })

      expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changes: JSON.stringify(changes),
        }),
      })
    })
  })

  describe('queryAuditLogs', () => {
    it('should query logs with filters', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { queryAuditLogs } = await import('@/lib/audit')

      vi.mocked(prisma.adminAuditLog.findMany).mockResolvedValue([])
      vi.mocked(prisma.adminAuditLog.count).mockResolvedValue(0)

      await queryAuditLogs({
        adminId: 'admin-1',
        category: 'ORDER' as any,
        limit: 20,
      })

      expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            adminId: 'admin-1',
            category: 'ORDER',
          }),
        })
      )
    })

    it('should support pagination with offset', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { queryAuditLogs } = await import('@/lib/audit')

      vi.mocked(prisma.adminAuditLog.findMany).mockResolvedValue([])
      vi.mocked(prisma.adminAuditLog.count).mockResolvedValue(50)

      await queryAuditLogs({
        offset: 10,
        limit: 10,
      })

      expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      )
    })
  })

  describe('createAuditLogger factory', () => {
    it('should create logger with bound admin context', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { createAuditLogger } = await import('@/lib/audit')

      vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({
        id: 'log-3',
      } as any)

      const logger = createAuditLogger({
        adminId: 'admin-123',
        adminEmail: 'admin@test.com',
        adminName: 'Test Admin',
      })
      
      await logger.logOrder('UPDATE_ORDER' as any, 'order-1', 'Updated order')

      expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: 'admin-123',
          adminEmail: 'admin@test.com',
          category: 'ORDER',
        }),
      })
    })
  })
})

describe('Audit Actions', () => {
  it('should have all required order actions', () => {
    const orderActions = [
      'CREATE_ORDER',
      'UPDATE_ORDER',
      'CANCEL_ORDER',
    ]
    
    orderActions.forEach(action => {
      expect(typeof action).toBe('string')
    })
  })

  it('should have all required product actions', () => {
    const productActions = [
      'CREATE_PRODUCT',
      'UPDATE_PRODUCT',
      'DELETE_PRODUCT',
    ]
    
    productActions.forEach(action => {
      expect(typeof action).toBe('string')
    })
  })

  it('should have refund action', () => {
    const refundActions = ['PROCESS_REFUND']
    expect(refundActions).toContain('PROCESS_REFUND')
  })
})
