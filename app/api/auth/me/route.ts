import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth/auth'

// GET /api/auth/me - Get current user from session
export async function GET(request: NextRequest) {
  try {
    // First, try NextAuth session (for OAuth users)
    const session = await auth()
    let userId: string | null = null

    if (session?.user?.id) {
      userId = session.user.id
    } else {
      // Fall back to cookie-based session (for existing email/password users)
      const sessionId = request.cookies.get('auth_session')?.value
      if (sessionId) {
        userId = sessionId
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Find the customer with loyalty data
    const customer = await prisma.customer.findUnique({
      where: { id: userId },
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
        // Loyalty fields
        currentPoints: true,
        lifetimePoints: true,
        annualPointsEarned: true,  // For tier progression
        totalSpent: true,
        totalOrders: true,
        annualSpend: true,
        loyaltyTier: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            minAnnualPoints: true,  // Points required for tier
            minAnnualSpend: true,
            pointMultiplier: true,
            freeShipping: true,
            earlyDropAccess: true,
            perks: true,
          },
        },
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
