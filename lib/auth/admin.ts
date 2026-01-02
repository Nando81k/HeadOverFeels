import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

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
 * Get the current admin user (throws error if not authenticated)
 * @param request - The Next.js request object
 * @returns The admin customer record
 * @throws Error if not authenticated or not an admin
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
    },
  })

  if (!customer) {
    throw new Error('User not found')
  }

  if (!customer.isAdmin) {
    throw new Error('Unauthorized - admin access required')
  }

  return customer
}
