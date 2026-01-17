import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { awardAccountCreationPoints, awardReferralWelcomeBonus } from '@/lib/loyalty/service'

export async function POST(request: Request) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      )
    }

    // Find customer with this verification token
    const customer = await prisma.customer.findFirst({
      where: {
        emailVerificationToken: token,
      },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (customer.emailVerificationExpires && customer.emailVerificationExpires < new Date()) {
      return NextResponse.json(
        { error: 'Verification token has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Check if already verified
    if (customer.emailVerified) {
      return NextResponse.json(
        { message: 'Email already verified' },
        { status: 200 }
      )
    }

    // Mark email as verified
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    })

    // Award welcome points now that email is verified (50 points)
    let pointsAwarded = 0
    try {
      await awardAccountCreationPoints(customer.id)
      pointsAwarded = 50
      console.log(`Awarded welcome points to customer ${customer.id} after email verification`)
    } catch (loyaltyError) {
      console.error(`Failed to award welcome points to customer ${customer.id}:`, loyaltyError)
    }

    // Award referral welcome bonus if they signed up with a referral code (+100 points)
    if (customer.referredBy) {
      try {
        await awardReferralWelcomeBonus(customer.id, customer.referredBy)
        pointsAwarded += 100
        console.log(`Awarded referral welcome bonus to customer ${customer.id}`)
      } catch (referralBonusError) {
        console.error(`Failed to award referral welcome bonus to customer ${customer.id}:`, referralBonusError)
      }
    }

    return NextResponse.json({
      success: true,
      message: pointsAwarded > 0 
        ? `Email verified successfully! You earned ${pointsAwarded} Care Points.`
        : 'Email verified successfully',
      pointsAwarded,
    })
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json(
      { error: 'An error occurred during verification' },
      { status: 500 }
    )
  }
}
