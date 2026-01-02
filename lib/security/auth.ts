import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Verifies that a session belongs to an admin user
 * CRITICAL: Always use this instead of checking x-is-admin headers
 * 
 * @param sessionId - The auth_session cookie value
 * @returns Customer record if admin, null if not admin or session invalid
 */
export async function verifyAdmin(sessionId: string | null | undefined) {
  if (!sessionId) {
    return null
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        email: true,
        isAdmin: true,
        createdAt: true,
      },
    })

    // Only return if user is actually an admin
    if (customer?.isAdmin === true) {
      return customer
    }

    return null
  } catch (error) {
    console.error('Error verifying admin:', error)
    return null
  }
}

/**
 * Middleware to check if request is from an admin
 * Returns error response if not authenticated/authorized
 * 
 * Usage in endpoints:
 * const admin = await requireAdmin(request)
 * if (!admin) {
 *   return unauthorizedResponse('Admin access required')
 * }
 */
export async function requireAdmin(request: NextRequest) {
  const sessionId = request.cookies.get('auth_session')?.value
  return await verifyAdmin(sessionId)
}

/**
 * Standard unauthorized response for admin endpoints
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  )
}

/**
 * Standard forbidden response for insufficient permissions
 */
export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json(
    { error: message },
    { status: 403 }
  )
}
