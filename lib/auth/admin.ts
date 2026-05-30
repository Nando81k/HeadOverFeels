import { NextRequest } from 'next/server'
import { AdminRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Re-export so callers can reference the enum without a separate import
export { AdminRole }

/**
 * Verify that the current request is from an authenticated admin user.
 * Accepts isAdmin=true (legacy boolean) OR a non-null adminRole (new RBAC).
 * @returns The admin customer's ID, or null if not authenticated / not admin.
 */
export async function verifyAdmin(request: NextRequest): Promise<string | null> {
  const sessionId = request.cookies.get('auth_session')?.value

  if (!sessionId) {
    return null
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        isAdmin: true,
        adminRole: true,
      },
    })

    if (!customer) {
      return null
    }

    // Accept either the legacy boolean or the new role column
    if (!customer.isAdmin && customer.adminRole === null) {
      return null
    }

    return customer.id
  } catch (error) {
    console.error('Admin verification error:', error)
    return null
  }
}

/**
 * Get the current admin user (throws if not authenticated / not admin).
 * Accepts isAdmin=true (legacy boolean) OR a non-null adminRole (new RBAC).
 * @returns The admin customer record.
 * @throws Error if not authenticated or not an admin.
 */
export async function requireAdmin(request: NextRequest) {
  const sessionId = request.cookies.get('auth_session')?.value

  if (!sessionId) {
    throw new Error('Not authenticated')
  }

  const customer = await prisma.customer.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      adminRole: true,
    },
  })

  if (!customer) {
    throw new Error('User not found')
  }

  // Accept either the legacy boolean or the new role column
  if (!customer.isAdmin && customer.adminRole === null) {
    throw new Error('Unauthorized - admin access required')
  }

  return customer
}

/**
 * Verify that the current request is from an admin with a specific role.
 * SUPER_ADMIN bypasses all role checks.
 * @param request - The Next.js request object.
 * @param requiredRole - The minimum AdminRole required for the action.
 * @returns The admin customer's ID, or null if the role requirement is not met.
 */
export async function verifyAdminRole(
  request: NextRequest,
  requiredRole: AdminRole
): Promise<string | null> {
  const sessionId = request.cookies.get('auth_session')?.value

  if (!sessionId) {
    return null
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        isAdmin: true,
        adminRole: true,
      },
    })

    if (!customer) {
      return null
    }

    // Must have an adminRole (null means non-admin)
    if (customer.adminRole === null) {
      return null
    }

    // SUPER_ADMIN bypasses all role gates
    if (
      customer.adminRole === AdminRole.SUPER_ADMIN ||
      customer.adminRole === requiredRole
    ) {
      return customer.id
    }

    return null
  } catch (error) {
    console.error('Admin role verification error:', error)
    return null
  }
}

/**
 * Require that the current request is from an admin with a specific role.
 * SUPER_ADMIN bypasses all role checks.
 * @param request - The Next.js request object.
 * @param requiredRole - The AdminRole required for the action.
 * @returns The admin customer record.
 * @throws Error if not authenticated or role requirement is not met.
 */
export async function requireAdminRole(
  request: NextRequest,
  requiredRole: AdminRole
) {
  const sessionId = request.cookies.get('auth_session')?.value

  if (!sessionId) {
    throw new Error('Not authenticated')
  }

  const customer = await prisma.customer.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      adminRole: true,
    },
  })

  if (!customer) {
    throw new Error('User not found')
  }

  if (customer.adminRole === null) {
    throw new Error('Unauthorized - admin access required')
  }

  // SUPER_ADMIN bypasses all role gates
  if (
    customer.adminRole !== AdminRole.SUPER_ADMIN &&
    customer.adminRole !== requiredRole
  ) {
    throw new Error(
      `Unauthorized - requires ${requiredRole} or SUPER_ADMIN role`
    )
  }

  return customer
}
