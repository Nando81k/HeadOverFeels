import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, securityHeaders, validateOrigin } from '@/lib/security/middleware'

/**
 * Rate limit configuration for different endpoints
 */
const RATE_LIMITS = {
  // Authentication endpoints - strict limits
  auth: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 requests per 15 minutes
  
  // API endpoints - moderate limits
  api: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
  
  // Admin endpoints - moderate limits
  admin: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 requests per minute
  
  // Default limit
  default: { maxRequests: 200, windowMs: 60 * 1000 }, // 200 requests per minute
}

/**
 * Apply rate limiting based on endpoint type
 */
export function applyRateLimit(request: NextRequest): NextResponse | null {
  const ip = getClientIp(request)
  const pathname = request.nextUrl.pathname
  
  // Determine rate limit type
  let limitConfig = RATE_LIMITS.default
  let limitKey = `default:${ip}`
  
  if (pathname.startsWith('/api/auth/signin') || pathname.startsWith('/api/auth/signup')) {
    limitConfig = RATE_LIMITS.auth
    limitKey = `auth:${ip}`
  } else if (pathname.startsWith('/api/admin')) {
    limitConfig = RATE_LIMITS.admin
    limitKey = `admin:${ip}`
  } else if (pathname.startsWith('/api')) {
    limitConfig = RATE_LIMITS.api
    limitKey = `api:${ip}`
  }
  
  // Check rate limit
  const { allowed, resetAt } = checkRateLimit(
    limitKey,
    limitConfig.maxRequests,
    limitConfig.windowMs
  )
  
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
    response.headers.set('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString())
    response.headers.set('Retry-After', Math.ceil((resetAt - Date.now()) / 1000).toString())
    
    return securityHeaders(response)
  }
  
  return null // Allow request to proceed
}

/**
 * Apply origin validation for mutation endpoints
 */
export function validateMutationOrigin(request: NextRequest): NextResponse | null {
  const method = request.method
  
  // Only validate for mutation methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null
  }
  
  // Skip validation for webhook endpoints (they come from external services)
  const pathname = request.nextUrl.pathname
  if (pathname.includes('/webhook')) {
    return null
  }
  
  // Validate origin
  if (!validateOrigin(request)) {
    return securityHeaders(
      NextResponse.json(
        {
          error: 'Invalid origin',
          message: 'Request origin does not match expected host',
        },
        { status: 403 }
      )
    )
  }
  
  return null
}

/**
 * Security middleware configuration
 * Export this to use in middleware.ts
 */
export async function securityMiddleware(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting
  const rateLimitResponse = applyRateLimit(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }
  
  // Validate origin for mutations
  const originResponse = validateMutationOrigin(request)
  if (originResponse) {
    return originResponse
  }
  
  // Continue to next middleware/handler
  return NextResponse.next()
}
