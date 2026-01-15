/**
 * Admin Audit Logging System
 * 
 * Provides comprehensive tracking of all admin actions for security,
 * compliance, and accountability purposes.
 */

import { prisma } from '@/lib/prisma';
import { AuditAction, AuditCategory, Prisma } from '@prisma/client';

// Re-export enums for convenience
export { AuditAction, AuditCategory } from '@prisma/client';

// ===== Types =====

export interface AuditLogInput {
  adminId: string;
  adminEmail: string;
  adminName: string;
  action: AuditAction;
  category: AuditCategory;
  description: string;
  targetId?: string;
  targetType?: string;
  targetLabel?: string;
  changes?: AuditChanges;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface AuditContext {
  adminId: string;
  adminEmail: string;
  adminName: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditQueryOptions {
  adminId?: string;
  action?: AuditAction;
  category?: AuditCategory;
  targetType?: string;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ===== Core Audit Functions =====

/**
 * Create an audit log entry
 */
export async function createAuditLog(input: AuditLogInput) {
  try {
    const log = await prisma.adminAuditLog.create({
      data: {
        adminId: input.adminId,
        adminEmail: input.adminEmail,
        adminName: input.adminName,
        action: input.action,
        category: input.category,
        description: input.description,
        targetId: input.targetId,
        targetType: input.targetType,
        targetLabel: input.targetLabel,
        changes: input.changes ? JSON.stringify(input.changes) : null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
    return log;
  } catch (error) {
    // Log to console but don't throw - audit logging should not break operations
    console.error('[AuditLog] Failed to create audit log:', error);
    return null;
  }
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(options: AuditQueryOptions = {}) {
  const where: Prisma.AdminAuditLogWhereInput = {};

  if (options.adminId) where.adminId = options.adminId;
  if (options.action) where.action = options.action;
  if (options.category) where.category = options.category;
  if (options.targetType) where.targetType = options.targetType;
  if (options.targetId) where.targetId = options.targetId;

  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) where.createdAt.gte = options.startDate;
    if (options.endDate) where.createdAt.lte = options.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  return { logs, total };
}

// ===== Helper Functions for Common Audit Scenarios =====

/**
 * Create an audit logger bound to admin context
 * Use this in API routes after authenticating the admin
 */
export function createAuditLogger(context: AuditContext) {
  return {
    /**
     * Log an order action
     */
    async logOrder(
      action: AuditAction,
      orderId: string,
      description: string,
      options?: { orderNumber?: string; changes?: AuditChanges; metadata?: Record<string, unknown> }
    ) {
      return createAuditLog({
        ...context,
        action,
        category: AuditCategory.ORDER,
        targetId: orderId,
        targetType: 'order',
        targetLabel: options?.orderNumber ? `Order #${options.orderNumber}` : undefined,
        description,
        changes: options?.changes,
        metadata: options?.metadata,
      });
    },

    /**
     * Log a product action
     */
    async logProduct(
      action: AuditAction,
      productId: string,
      description: string,
      options?: { productName?: string; changes?: AuditChanges; metadata?: Record<string, unknown> }
    ) {
      return createAuditLog({
        ...context,
        action,
        category: AuditCategory.PRODUCT,
        targetId: productId,
        targetType: 'product',
        targetLabel: options?.productName ? `Product: ${options.productName}` : undefined,
        description,
        changes: options?.changes,
        metadata: options?.metadata,
      });
    },

    /**
     * Log an inventory action
     */
    async logInventory(
      action: AuditAction,
      variantId: string,
      description: string,
      options?: { sku?: string; changes?: AuditChanges; metadata?: Record<string, unknown> }
    ) {
      return createAuditLog({
        ...context,
        action,
        category: AuditCategory.INVENTORY,
        targetId: variantId,
        targetType: 'variant',
        targetLabel: options?.sku ? `SKU: ${options.sku}` : undefined,
        description,
        changes: options?.changes,
        metadata: options?.metadata,
      });
    },

    /**
     * Log a customer action
     */
    async logCustomer(
      action: AuditAction,
      customerId: string,
      description: string,
      options?: { customerEmail?: string; changes?: AuditChanges; metadata?: Record<string, unknown> }
    ) {
      return createAuditLog({
        ...context,
        action,
        category: AuditCategory.CUSTOMER,
        targetId: customerId,
        targetType: 'customer',
        targetLabel: options?.customerEmail ? `Customer: ${options.customerEmail}` : undefined,
        description,
        changes: options?.changes,
        metadata: options?.metadata,
      });
    },

    /**
     * Log a support ticket action
     */
    async logSupportTicket(
      action: AuditAction,
      ticketId: string,
      description: string,
      options?: { ticketNumber?: string; changes?: AuditChanges; metadata?: Record<string, unknown> }
    ) {
      return createAuditLog({
        ...context,
        action,
        category: AuditCategory.SUPPORT_TICKET,
        targetId: ticketId,
        targetType: 'support_ticket',
        targetLabel: options?.ticketNumber ? `Ticket #${options.ticketNumber}` : undefined,
        description,
        changes: options?.changes,
        metadata: options?.metadata,
      });
    },

    /**
     * Log a refund action
     */
    async logRefund(
      action: AuditAction,
      orderId: string,
      description: string,
      options?: { orderNumber?: string; amount?: number; changes?: AuditChanges; metadata?: Record<string, unknown> }
    ) {
      return createAuditLog({
        ...context,
        action,
        category: AuditCategory.REFUND,
        targetId: orderId,
        targetType: 'order',
        targetLabel: options?.orderNumber ? `Refund for Order #${options.orderNumber}` : undefined,
        description,
        changes: options?.changes,
        metadata: { ...options?.metadata, refundAmount: options?.amount },
      });
    },

    /**
     * Log a promotion action
     */
    async logPromotion(
      action: AuditAction,
      promotionId: string,
      description: string,
      options?: { promoCode?: string; changes?: AuditChanges; metadata?: Record<string, unknown> }
    ) {
      return createAuditLog({
        ...context,
        action,
        category: AuditCategory.PROMOTION,
        targetId: promotionId,
        targetType: 'promotion',
        targetLabel: options?.promoCode ? `Promo: ${options.promoCode}` : undefined,
        description,
        changes: options?.changes,
        metadata: options?.metadata,
      });
    },

    /**
     * Log a drop/limited edition action
     */
    async logDrop(
      action: AuditAction,
      productId: string,
      description: string,
      options?: { productName?: string; changes?: AuditChanges; metadata?: Record<string, unknown> }
    ) {
      return createAuditLog({
        ...context,
        action,
        category: AuditCategory.DROP,
        targetId: productId,
        targetType: 'product',
        targetLabel: options?.productName ? `Drop: ${options.productName}` : undefined,
        description,
        changes: options?.changes,
        metadata: options?.metadata,
      });
    },

    /**
     * Log authentication events
     */
    async logAuth(
      action: typeof AuditAction.LOGIN | typeof AuditAction.LOGOUT,
      description: string,
      metadata?: Record<string, unknown>
    ) {
      return createAuditLog({
        ...context,
        action,
        category: AuditCategory.AUTHENTICATION,
        description,
        metadata,
      });
    },

    /**
     * Log a generic action
     */
    async log(
      action: AuditAction,
      category: AuditCategory,
      description: string,
      options?: {
        targetId?: string;
        targetType?: string;
        targetLabel?: string;
        changes?: AuditChanges;
        metadata?: Record<string, unknown>;
      }
    ) {
      return createAuditLog({
        ...context,
        action,
        category,
        description,
        ...options,
      });
    },
  };
}

// ===== Utility Functions =====

/**
 * Calculate changes between two objects for audit logging
 */
export function calculateChanges<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fieldsToTrack?: (keyof T)[]
): AuditChanges {
  const beforeChanges: Record<string, unknown> = {};
  const afterChanges: Record<string, unknown> = {};

  const fields = fieldsToTrack || (Object.keys(after) as (keyof T)[]);

  for (const field of fields) {
    const beforeValue = before[field];
    const afterValue = after[field];

    // Simple comparison (handles primitives)
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      beforeChanges[field as string] = beforeValue;
      afterChanges[field as string] = afterValue;
    }
  }

  return {
    before: Object.keys(beforeChanges).length > 0 ? beforeChanges : undefined,
    after: Object.keys(afterChanges).length > 0 ? afterChanges : undefined,
  };
}

/**
 * Extract request context from headers for audit logging
 */
export function extractRequestContext(headers: Headers): { ipAddress?: string; userAgent?: string } {
  return {
    ipAddress:
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headers.get('x-real-ip') ||
      undefined,
    userAgent: headers.get('user-agent') || undefined,
  };
}

/**
 * Format audit log for display
 */
export function formatAuditLog(log: {
  action: AuditAction;
  category: AuditCategory;
  description: string;
  targetLabel?: string | null;
  adminName: string;
  createdAt: Date;
}) {
  return {
    action: log.action.toLowerCase().replace(/_/g, ' '),
    category: log.category.toLowerCase().replace(/_/g, ' '),
    description: log.description,
    target: log.targetLabel || 'N/A',
    admin: log.adminName,
    timestamp: log.createdAt.toISOString(),
  };
}
