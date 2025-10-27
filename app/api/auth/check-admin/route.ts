import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/auth/check-admin - Check if current user is admin
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('auth_session')?.value

    if (!sessionId) {
      return NextResponse.json(
        { isAdmin: false, error: 'No session' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const customer = await prisma.customer.findUnique({
      where: { id: sessionId },
      select: { isAdmin: true },
    })

    if (!customer) {
      return NextResponse.json(
        { isAdmin: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ isAdmin: customer.isAdmin })
  } catch (error) {
    console.error('Check admin error:', error)
    return NextResponse.json(
      { isAdmin: false, error: 'Failed to check admin status' },
      { status: 500 }
    )
  }
}
