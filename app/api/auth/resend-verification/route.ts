import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/email/auth'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Find customer
    const customer = await prisma.customer.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (!customer) {
      // Don't reveal if email exists
      return NextResponse.json({
        success: true,
        message: 'If your email is registered, you will receive a verification link.',
      })
    }

    // Check if already verified
    if (customer.emailVerified) {
      return NextResponse.json(
        { error: 'Email is already verified' },
        { status: 400 }
      )
    }

    // Rate limit: check if a verification email was sent recently (within 2 minutes)
    if (customer.emailVerificationExpires) {
      const tokenCreatedAt = new Date(customer.emailVerificationExpires.getTime() - 24 * 60 * 60 * 1000)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
      
      if (tokenCreatedAt > twoMinutesAgo) {
        return NextResponse.json(
          { error: 'Please wait 2 minutes before requesting another verification email' },
          { status: 429 }
        )
      }
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Update customer with new token
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    })

    // Send verification email
    await sendVerificationEmail({
      email: customer.email,
      name: customer.name || '',
      verificationToken,
    })

    return NextResponse.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'An error occurred while sending verification email' },
      { status: 500 }
    )
  }
}
