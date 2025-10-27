import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/auth/me - Get current user from session
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('auth_session')?.value

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Find the customer
    const customer = await prisma.customer.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        birthday: true,
        newsletter: true,
        smsOptIn: true,
        isAdmin: true,
        createdAt: true,
      },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: customer })
  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    )
  }
}
