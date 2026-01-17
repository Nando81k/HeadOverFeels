import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email/auth'
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

    // Always return success to prevent email enumeration
    if (!customer) {
      return NextResponse.json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link.',
      })
    }

    // Check if customer has a password (not OAuth-only account)
    if (!customer.password) {
      // This is an OAuth-only account
      return NextResponse.json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link.',
      })
    }

    // Rate limit: check if a reset email was sent recently (within 2 minutes)
    if (customer.passwordResetExpires) {
      const tokenCreatedAt = new Date(customer.passwordResetExpires.getTime() - 60 * 60 * 1000)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
      
      if (tokenCreatedAt > twoMinutesAgo) {
        return NextResponse.json(
          { error: 'Please wait 2 minutes before requesting another reset email' },
          { status: 429 }
        )
      }
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Update customer with reset token
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    })

    // Send password reset email
    await sendPasswordResetEmail({
      email: customer.email,
      name: customer.name || '',
      resetToken,
    })

    return NextResponse.json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    )
  }
}
