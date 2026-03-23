import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { checkRateLimit, rateLimitResponse, getClientIdentifier, RATE_LIMITS } from '@/lib/security/rateLimit'
import { createSessionToken } from '@/lib/auth/session'

const signinSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
})

// POST /api/auth/signin - Sign in a user
export async function POST(request: NextRequest) {
  // Rate limit by IP address: 5 attempts per minute
  const clientIp = getClientIdentifier(request.headers)
  const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.auth.maxRequests, RATE_LIMITS.auth.windowMs)

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfter)
  }

  try {
    const body = await request.json()
    const validatedData = signinSchema.parse(body)
    
    // Normalize email to lowercase (emails are case-insensitive per RFC 5321)
    const normalizedEmail = validatedData.email.toLowerCase()

    // Find the customer with full data including loyalty tier
    const customer = await prisma.customer.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
        password: {
          not: null,
        },
      },
      orderBy: [
        { totalOrders: 'desc' },
        { lifetimePoints: 'desc' },
        { currentPoints: 'desc' },
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        phone: true,
        birthday: true,
        newsletter: true,
        smsOptIn: true,
        isAdmin: true,
        createdAt: true,
        emailVerified: true,
        // Loyalty fields
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
      },
    })

    if (!customer || !customer.password) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify the password
    const passwordMatch = await bcrypt.compare(
      validatedData.password,
      customer.password
    )

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if email is verified - allow sign in but include verification status
    const needsVerification = !customer.emailVerified && !customer.isAdmin

    // Create session cookie - exclude password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...customerData } = customer
    
    const response = NextResponse.json({ 
      data: customerData,
      message: needsVerification 
        ? 'Signed in successfully. Please verify your email to earn 50 Care Points!'
        : 'Signed in successfully',
      requiresVerification: needsVerification,
    })
    
    response.cookies.set('auth_session', customer.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    // Create JWT token for Edge-compatible auth (admin checks in middleware)
    const token = await createSessionToken({
      userId: customer.id,
      email: customer.email,
      isAdmin: customer.isAdmin,
    })
    
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error('Signin database initialization error:', error)
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again in a moment.' },
        { status: 503 }
      )
    }

    if (
      error instanceof Prisma.PrismaClientValidationError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022')
    ) {
      console.error('Signin schema mismatch error:', error)
      return NextResponse.json(
        { error: 'Authentication service is updating. Please retry shortly.' },
        { status: 503 }
      )
    }

    console.error('Signin error:', error)
    return NextResponse.json(
      { error: 'Failed to sign in' },
      { status: 500 }
    )
  }
}
