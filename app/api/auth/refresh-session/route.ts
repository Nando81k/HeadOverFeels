import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSessionToken } from '@/lib/auth/session'

// GET /api/auth/refresh-session - Refresh session to add JWT token
// This is called when users have old auth_session but no auth_token
export async function GET(request: NextRequest) {
  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/'
  
  try {
    // Get the old session cookie
    const sessionId = request.cookies.get('auth_session')?.value

    if (!sessionId) {
      // No session at all - redirect to signin
      const signinUrl = new URL('/signin', request.url)
      signinUrl.searchParams.set('redirect', redirectTo)
      return NextResponse.redirect(signinUrl)
    }

    // Find the customer by their session ID (which is their user ID)
    const customer = await prisma.customer.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        email: true,
        isAdmin: true,
      },
    })

    if (!customer) {
      // Session is invalid - clear it and redirect to signin
      const signinUrl = new URL('/signin', request.url)
      signinUrl.searchParams.set('redirect', redirectTo)
      const response = NextResponse.redirect(signinUrl)
      response.cookies.delete('auth_session')
      return response
    }

    // Create new JWT token
    const token = await createSessionToken({
      userId: customer.id,
      email: customer.email,
      isAdmin: customer.isAdmin,
    })

    // Redirect to the original destination with the new token
    const redirectUrl = new URL(redirectTo, request.url)
    const response = NextResponse.redirect(redirectUrl)
    
    // Set the JWT token cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Session refresh error:', error)
    const signinUrl = new URL('/signin', request.url)
    signinUrl.searchParams.set('redirect', redirectTo)
    return NextResponse.redirect(signinUrl)
  }
}
