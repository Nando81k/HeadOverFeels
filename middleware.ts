import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { securityHeaders, checkRateLimit, getClientIp, validateOrigin } from '@/lib/security/middleware'
import { jwtVerify } from 'jose'

// Rate limit configurations
const RATE_LIMITS = {
  auth: { maxRequests: process.env.NODE_ENV === 'development' ? 20 : 5, windowMs: 15 * 60 * 1000 },
  api: { maxRequests: 100, windowMs: 60 * 1000 },
  admin: { maxRequests: 60, windowMs: 60 * 1000 },
}

// JWT verification for Edge Runtime
function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is required')
  }
  return secret
}

async function verifyAuthToken(token: string): Promise<{ userId: string; email: string; isAdmin: boolean } | null> {
  try {
    const secretKey = new TextEncoder().encode(getAuthSecret())
    const { payload } = await jwtVerify(token, secretKey)
    return payload as { userId: string; email: string; isAdmin: boolean }
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // ============ SECURITY: Rate Limiting ============
  const ip = getClientIp(request)
  let limitConfig = RATE_LIMITS.api
  let limitKey = `api:${ip}`
  
  if (pathname.startsWith('/api/auth/signin') || pathname.startsWith('/api/auth/signup')) {
    limitConfig = RATE_LIMITS.auth
    limitKey = `auth:${ip}`
  } else if (pathname.startsWith('/api/admin')) {
    limitConfig = RATE_LIMITS.admin
    limitKey = `admin:${ip}`
  }
  
  const { allowed, resetAt } = checkRateLimit(limitKey, limitConfig.maxRequests, limitConfig.windowMs)
  
  if (!allowed) {
    const response = NextResponse.json(
      {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      },
      { status: 429 }
    )
    response.headers.set('X-RateLimit-Limit', limitConfig.maxRequests.toString())
    response.headers.set('X-RateLimit-Remaining', '0')
    response.headers.set('Retry-After', Math.ceil((resetAt - Date.now()) / 1000).toString())
    return securityHeaders(response)
  }
  
  // ============ SECURITY: Origin Validation for Mutations ============
  const method = request.method
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !pathname.includes('/webhook')) {
    if (!validateOrigin(request)) {
      return securityHeaders(
        NextResponse.json(
          { error: 'Invalid origin', message: 'Request origin does not match expected host' },
          { status: 403 }
        )
      )
    }
  }
  
  // ============ ADMIN ROUTE PROTECTION ============
  if (pathname.startsWith('/admin')) {
    const authToken = request.cookies.get('auth_token')?.value
    const authSession = request.cookies.get('auth_session')?.value

    // No tokens at all - redirect to signin
    if (!authToken && !authSession) {
      const url = new URL('/signin', request.url)
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    // Has old session but no JWT token - redirect to refresh session
    // This happens for users who logged in before JWT was implemented
    if (!authToken && authSession) {
      const url = new URL('/api/auth/refresh-session', request.url)
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    try {
      // Verify JWT token directly in Edge Runtime (no API call needed)
      const session = await verifyAuthToken(authToken!)

      if (!session || !session.isAdmin) {
        // Not an admin - redirect to home
        const url = new URL('/', request.url)
        return NextResponse.redirect(url)
      }
    } catch (error) {
      console.error('Middleware auth check failed:', error)
      const url = new URL('/signin', request.url)
      return NextResponse.redirect(url)
    }
  }

  // Apply security headers to all responses
  const response = NextResponse.next()
  return securityHeaders(response)
}

export const config = {
  matcher: ['/admin/:path*', '/admin'],
}
