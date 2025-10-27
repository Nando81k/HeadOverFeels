import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

// POST /api/auth/signin - Sign in a user
export async function POST(request: NextRequest) {
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
        isAdmin: true,
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
