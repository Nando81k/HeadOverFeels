import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate input
    const validation = resetPasswordSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { token, password } = validation.data

    // Find customer with this reset token
    const customer = await prisma.customer.findFirst({
      where: {
        passwordResetToken: token,
      },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (customer.passwordResetExpires && customer.passwordResetExpires < new Date()) {
      return NextResponse.json(
        { error: 'Reset token has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Update customer password and clear reset token
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'An error occurred while resetting your password' },
      { status: 500 }
    )
  }
}

// GET endpoint to validate token
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Find customer with this reset token
    const customer = await prisma.customer.findFirst({
      where: {
        passwordResetToken: token,
      },
    })

    if (!customer) {
      return NextResponse.json(
        { valid: false, error: 'Invalid reset token' },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (customer.passwordResetExpires && customer.passwordResetExpires < new Date()) {
      return NextResponse.json(
        { valid: false, error: 'Reset token has expired' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      email: customer.email,
    })
  } catch (error) {
    console.error('Token validation error:', error)
    return NextResponse.json(
      { valid: false, error: 'An error occurred' },
      { status: 500 }
    )
  }
}
