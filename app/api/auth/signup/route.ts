import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'
import { checkRateLimit, rateLimitResponse, getClientIdentifier, RATE_LIMITS } from '@/lib/security/rateLimit'
import { createSessionToken } from '@/lib/auth/session'
import { sendVerificationEmail, sendWelcomeEmail } from '@/lib/email/auth'

const signupSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(255, 'Name too long'),
  referralCode: z.string().optional(),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the Terms of Service and Privacy Policy',
  }),
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
    
    // Normalize email to lowercase (emails are case-insensitive per RFC 5321)
    const normalizedEmail = validatedData.email.toLowerCase()

    // Check if user already exists (don't reveal whether email exists)
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
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

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create the customer
    const newCustomer = await prisma.customer.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: validatedData.name,
        referredBy: referrerId,
        loyaltyTierId: defaultTier?.id, // Assign default tier
        termsAcceptedAt: new Date(),
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
      select: {
        id: true,
        email: true,
        isAdmin: true,
        name: true,
      },
    })

    // Note: Welcome points (50 points) are now awarded after email verification
    // This incentivizes users to verify their email

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

    // Send verification email
    try {
      await sendVerificationEmail({
        email: newCustomer.email,
        name: newCustomer.name || '',
        verificationToken,
      })
      console.log(`Verification email sent to ${newCustomer.email}`)
    } catch (emailError) {
      console.error(`Failed to send verification email to ${newCustomer.email}:`, emailError)
      // Don't fail signup if email fails - they can request a new one
    }

    // Send welcome email (non-blocking)
    sendWelcomeEmail({
      email: newCustomer.email,
      name: newCustomer.name || '',
    }).catch(err => {
      console.error(`Failed to send welcome email to ${newCustomer.email}:`, err)
    })

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

    // Create session and auto-sign in the user
    const response = NextResponse.json({ 
      data: customer,
      message: 'Account created successfully! Please check your email to verify your account and earn 50 Care Points.',
      requiresVerification: true,
    })
    
    // Set auth_session cookie (customer ID)
    response.cookies.set('auth_session', customer!.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    // Create JWT token for Edge-compatible auth
    const token = await createSessionToken({
      userId: customer!.id,
      email: customer!.email,
      isAdmin: customer!.isAdmin,
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
