import { NextRequest } from 'next/server'
import { AdminRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Re-exported so API routes can gate on roles without importing Prisma directly.
export { AdminRole }

/**
 * Verify that the current request is from an authenticated admin user
 * @param request - The Next.js request object
 * @returns The admin user's ID if authenticated, or null if not
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
        isAdmin: true 
      },
    })

    if (!customer || !customer.isAdmin) {
      return null
    }

    return customer.id
  } catch (error) {
    console.error('Admin verification error:', error)
    return null
  }
}

/**
 * Verify that the request is from an admin holding `role`.
 * Same cookie-based path as `verifyAdmin` (API routes). SUPER_ADMIN satisfies
 * every role check, mirroring the RBAC helpers introduced in #41.
 *
 * @returns The admin user's ID, or null if unauthenticated / wrong role
 */
export async function verifyAdminRole(request: NextRequest, role: AdminRole): Promise<string | null> {
  const sessionId = request.cookies.get('auth_session')?.value

  if (!sessionId) {
    return null
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: sessionId },
      select: { id: true, isAdmin: true, adminRole: true },
    })

    if (!customer || !customer.isAdmin) {
      return null
    }

    if (customer.adminRole !== role && customer.adminRole !== AdminRole.SUPER_ADMIN) {
      return null
    }

    return customer.id
  } catch (error) {
    console.error('Admin role verification error:', error)
    return null
  }
}

/**
 * Get the current admin user (throws error if not authenticated).
 *
 * Two call signatures:
 *   requireAdmin(request)  — API route usage (reads auth_session cookie from NextRequest)
 *   requireAdmin()         — Server Action usage (reads auth_token JWT via next/headers)
 *
 * @throws Error if not authenticated or not an admin
 */
/**
 * Two call signatures:
 *   requireAdmin(request)  — API route usage (reads auth_session cookie from NextRequest)
 *   requireAdmin()         — Server Action usage (reads auth_token JWT via next/headers)
 *
 * Returns a customer object (API-route path) or userId string (Server Action path).
 * @throws Error if not authenticated or not an admin
 */
export async function requireAdmin(request: NextRequest): Promise<{ id: string; email: string; name: string | null; isAdmin: boolean }>
export async function requireAdmin(): Promise<string>
export async function requireAdmin(
  request?: NextRequest,
): Promise<{ id: string; email: string; name: string | null; isAdmin: boolean } | string> {
  if (request) {
    // API-route path: read auth_session cookie from the request
    const sessionId = request.cookies.get('auth_session')?.value
    if (!sessionId) throw new Error('Not authenticated')

    const customer = await prisma.customer.findUnique({
      where: { id: sessionId },
      select: { id: true, email: true, name: true, isAdmin: true },
    })
    if (!customer) throw new Error('User not found')
    if (!customer.isAdmin) throw new Error('Unauthorized - admin access required')
    return customer
  }

  // Server Action path: verify JWT session from cookies (next/headers)
  const { getSession } = await import('@/lib/auth/session')
  const session = await getSession()
  if (!session || !session.isAdmin) {
    throw new Error('Unauthorized — admin access required')
  }
  return session.userId
}

/**
 * Role-gated guard for Server Actions.
 * Verifies the session is an admin and that adminRole matches.
 */
export async function requireAdminRole(role: string): Promise<string> {
  const { getSession } = await import('@/lib/auth/session')
  const session = await getSession()
  if (!session || !session.isAdmin) {
    throw new Error('Unauthorized — admin access required')
  }
  const customer = await prisma.customer.findUnique({
    where: { id: session.userId },
    select: { adminRole: true },
  })
  if (!customer || customer.adminRole !== role) {
    throw new Error(`Unauthorized — requires role ${role}`)
  }
  return session.userId
}

/** @deprecated Use requireAdmin() (no-arg) in Server Actions instead */
export const requireAdminForAction = requireAdmin
