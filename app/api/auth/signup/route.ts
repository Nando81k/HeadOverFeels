import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { awardAccountCreationPoints, awardReferralWelcomeBonus } from '@/lib/loyalty/service'
import { checkRateLimit, rateLimitResponse, getClientIdentifier, RATE_LIMITS } from '@/lib/security/rateLimit'
import { createSessionToken } from '@/lib/auth/session'

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
    console.log('Signup request body:', JSON.stringify(body))
    
    const validatedData = signupSchema.parse(body)
    console.log('Validated data:', JSON.stringify(validatedData))

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
    const newCustomer = await prisma.customer.create({
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
        isAdmin: true,
      },
    })

    // Award welcome points (50 points for account creation)
    try {
      await awardAccountCreationPoints(newCustomer.id)
      console.log(`Awarded welcome points to customer ${newCustomer.id}`)
    } catch (loyaltyError) {
      // Log error but don't fail signup
      console.error(`Failed to award welcome points to customer ${newCustomer.id}:`, loyaltyError)
    }

    // Award referral welcome bonus if they signed up with a referral code (+100 points)
    if (referrerId) {
      try {
        await awardReferralWelcomeBonus(newCustomer.id, referrerId)
        console.log(`Awarded referral welcome bonus to customer ${newCustomer.id}`)
      } catch (referralBonusError) {
        // Log error but don't fail signup
        console.error(`Failed to award referral welcome bonus to customer ${newCustomer.id}:`, referralBonusError)
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

    // Fetch the full customer data with loyalty tier (after points were awarded)
    const customer = await prisma.customer.findUnique({
      where: { id: newCustomer.id },
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

    // Create session cookie
    const response = NextResponse.json({ 
      data: customer,
      message: 'Account created successfully' 
    })
    
    response.cookies.set('auth_session', newCustomer.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    // Create JWT token for Edge-compatible auth (admin checks in middleware)
    const token = await createSessionToken({
      userId: newCustomer.id,
      email: newCustomer.email,
      isAdmin: newCustomer.isAdmin,
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
      console.log('Validation error:', JSON.stringify(error.issues))
      return NextResponse.json(
        { error: error.issues[0].message, issues: error.issues },
        { status: 400 }
      )
    }

    console.error('Signup error:', error)
    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Failed to create account'
    return NextResponse.json(
      { 
        error: 'Failed to create account',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}
