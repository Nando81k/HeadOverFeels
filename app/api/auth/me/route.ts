import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth/auth'

const CANONICAL_CUSTOMER_ORDER = [
  { totalOrders: 'desc' as const },
  { lifetimePoints: 'desc' as const },
  { currentPoints: 'desc' as const },
  { createdAt: 'asc' as const },
]

const CUSTOMER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  birthday: true,
  newsletter: true,
  smsOptIn: true,
  isAdmin: true,
  createdAt: true,
  profilePictureUrl: true,
  currentPoints: true,
  lifetimePoints: true,
  annualPointsEarned: true,
  totalSpent: true,
  totalOrders: true,
  annualSpend: true,
  loyaltyTier: {
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      primaryColor: true,
      secondaryColor: true,
      minAnnualPoints: true,
      minAnnualSpend: true,
      pointMultiplier: true,
      freeShipping: true,
      earlyDropAccess: true,
      perks: true,
    },
  },
} as const

async function findCustomerSnapshotById(customerId: string) {
  return prisma.customer.findUnique({
    where: { id: customerId },
    select: CUSTOMER_SELECT,
  })
}

// GET /api/auth/me - Get current user from session
export async function GET(request: NextRequest) {
  try {
    // First, try NextAuth session (for OAuth users)
    const session = await auth()
    const authSessionCookie = request.cookies.get('auth_session')?.value
    let userId: string | null = null

    if (session?.user?.id) {
      userId = session.user.id
    } else {
      // Fall back to cookie-based session (for existing email/password users)
      if (authSessionCookie) {
        userId = authSessionCookie
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const baseCustomer = await prisma.customer.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    })

    const referenceEmail =
      session?.user?.email?.toLowerCase().trim() ||
      baseCustomer?.email.toLowerCase().trim() ||
      null

    let customer = null as Awaited<ReturnType<typeof findCustomerSnapshotById>>
    if (referenceEmail) {
      customer = await prisma.customer.findFirst({
        where: {
          email: {
            equals: referenceEmail,
            mode: 'insensitive',
          },
        },
        orderBy: CANONICAL_CUSTOMER_ORDER,
        select: CUSTOMER_SELECT,
      })
    }

    if (!customer && userId) {
      customer = await findCustomerSnapshotById(userId)
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const response = NextResponse.json({ data: customer })

    if (authSessionCookie !== customer.id) {
      response.cookies.set('auth_session', customer.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
    }

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('GET /api/auth/me failed:', message)
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    )
  }
}
