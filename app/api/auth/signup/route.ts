import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { awardAccountCreationPoints, awardReferralWelcomeBonus } from '@/lib/loyalty/service'
import { checkRateLimit, rateLimitResponse, getClientIdentifier, RATE_LIMITS } from '@/lib/security/rateLimit'

const signupSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(255, 'Name too long'),
  referralCode: z.string().optional(),
})

// POST /api/auth/signup - Register a new user
export async function POST(request: NextRequest) {
  // Rate limit by IP address: 5 attempts per minute
  const clientIp = getClientIdentifier(request.headers)
  const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.auth.maxRequests, RATE_LIMITS.auth.windowMs)

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfter)
  }

  try {
    const body = await request.json()
    const validatedData = signupSchema.parse(body)

    // Check if user already exists (don't reveal whether email exists)
    const existingCustomer = await prisma.customer.findUnique({
      where: { email: validatedData.email },
    })

    if (existingCustomer) {
      return NextResponse.json(
        { error: 'Unable to create account. Please try again.' },
        { status: 400 }
      )
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12)

    // Validate referral code if provided
    let referrerId: string | null = null
    if (validatedData.referralCode) {
      const referralCodeRecord = await prisma.referralCode.findUnique({
        where: { code: validatedData.referralCode },
      })
      if (referralCodeRecord) {
        referrerId = referralCodeRecord.customerId
      }
    }

    // Get the default "Head" tier
    const defaultTier = await prisma.loyaltyTier.findFirst({
      where: { slug: 'head' },
    })

    // Create the customer
    const customer = await prisma.customer.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        referredBy: referrerId,
        loyaltyTierId: defaultTier?.id, // Assign default tier
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    })

    // Award welcome points (50 points for account creation)
    try {
      await awardAccountCreationPoints(customer.id)
      console.log(`Awarded welcome points to customer ${customer.id}`)
    } catch (loyaltyError) {
      // Log error but don't fail signup
      console.error(`Failed to award welcome points to customer ${customer.id}:`, loyaltyError)
    }

    // Award referral welcome bonus if they signed up with a referral code (+100 points)
    if (referrerId) {
      try {
        await awardReferralWelcomeBonus(customer.id, referrerId)
        console.log(`Awarded referral welcome bonus to customer ${customer.id}`)
      } catch (referralBonusError) {
        // Log error but don't fail signup
        console.error(`Failed to award referral welcome bonus to customer ${customer.id}:`, referralBonusError)
      }
    }

    // Update referral code usage count
    if (referrerId && validatedData.referralCode) {
      try {
        await prisma.referralCode.update({
          where: { code: validatedData.referralCode },
          data: { timesUsed: { increment: 1 } },
        })
        console.log(`Updated referral code usage for ${validatedData.referralCode}`)
      } catch (referralError) {
        console.error(`Failed to update referral code usage:`, referralError)
      }
    }

    // Create session cookie
    const response = NextResponse.json({ 
      data: customer,
      message: 'Account created successfully' 
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

    console.error('Signup error:', error)
    // Return more detailed error (temporarily showing in production for debugging)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create account'
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      { 
        error: 'Failed to create account',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}
