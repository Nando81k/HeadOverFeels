import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { checkRateLimit, rateLimitResponse, getClientIdentifier, RATE_LIMITS } from '@/lib/security/rateLimit'

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

    // Find the customer
    const customer = await prisma.customer.findUnique({
      where: { email: validatedData.email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        createdAt: true,
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

    // Create session cookie
    const { password, ...customerData } = customer
    
    const response = NextResponse.json({ 
      data: customerData,
      message: 'Signed in successfully' 
    })
    
    response.cookies.set('auth_session', customer.id, {
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

    console.error('Signin error:', error)
    return NextResponse.json(
      { error: 'Failed to sign in' },
      { status: 500 }
    )
  }
}
