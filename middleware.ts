import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { securityHeaders, checkRateLimit, getClientIp, validateOrigin } from '@/lib/security/middleware'

// Rate limit configurations
const RATE_LIMITS = {
  auth: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  api: { maxRequests: 100, windowMs: 60 * 1000 },
  admin: { maxRequests: 60, windowMs: 60 * 1000 },
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
    const sessionId = request.cookies.get('auth_session')?.value

    console.log('🔍 Middleware Debug:')
    console.log('   Path:', pathname)
    console.log('   Session ID:', sessionId)

    // No session - redirect to signin
    if (!sessionId) {
      console.log('   ❌ No session found - redirecting to signin')
      const url = new URL('/signin', request.url)
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    try {
      // Call API route to check admin status (Edge Runtime compatible)
      const apiUrl = new URL('/api/auth/check-admin', request.url)
      const response = await fetch(apiUrl, {
        headers: {
          Cookie: `auth_session=${sessionId}`,
        },
      })

      const data = await response.json()
      console.log('   Admin check response:', data)

      if (!response.ok || !data.isAdmin) {
        // Not an admin - redirect to home
        console.log('   ❌ Not an admin - redirecting to home')
        const url = new URL('/', request.url)
        return NextResponse.redirect(url)
      }

      console.log('   ✅ Admin access granted')
    } catch (error) {
      console.error('   ❌ Middleware auth check failed:', error)
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
