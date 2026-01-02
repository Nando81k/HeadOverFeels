import { NextResponse } from 'next/server'

/**
 * Rate limit store using in-memory Map with Redis fallback support
 * For production, implement Redis persistence
 */
interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Check rate limit for an identifier
 * @param identifier - IP address, user ID, or email
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { allowed, remaining, retryAfter }
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  // Clean up expired entries periodically (every 100 checks)
  if (Math.random() < 0.01) {
    cleanupExpiredEntries()
  }

  if (!entry || entry.resetAt < now) {
    // New time window
    const resetAt = now + windowMs
    rateLimitStore.set(identifier, { count: 1, resetAt })
    return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 }
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, remaining: 0, retryAfter }
  }

  entry.count++
  const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
  return { allowed: true, remaining: maxRequests - entry.count, retryAfter }
}

/**
 * Clean up expired rate limit entries to prevent memory leaks
 */
function cleanupExpiredEntries() {
  const now = Date.now()
  let deleted = 0

  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key)
      deleted++
    }
  }

  if (deleted > 0) {
    console.log(`Cleaned up ${deleted} expired rate limit entries`)
  }
}

/**
 * Rate limit response helper
 * Returns 429 Too Many Requests response with proper headers
 */
export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + retryAfter * 1000).toISOString(),
      },
    }
  )
}

/**
 * Common rate limit configurations
 */
export const RATE_LIMITS = {
  // Auth endpoints: 5 attempts per minute per IP
  auth: { maxRequests: 5, windowMs: 60000 },
  // API endpoints: 100 requests per minute per user
  api: { maxRequests: 100, windowMs: 60000 },
  // File uploads: 20 per minute per user
  upload: { maxRequests: 20, windowMs: 60000 },
  // Cron jobs: 1 per minute per HMAC key
  cron: { maxRequests: 1, windowMs: 60000 },
  // Loyalty operations: 10 per minute per user
  loyalty: { maxRequests: 10, windowMs: 60000 },
  // Search: 30 per minute per IP
  search: { maxRequests: 30, windowMs: 60000 },
}

/**
 * Get client identifier (IP address) from request headers
 */
export function getClientIdentifier(headers: Headers): string {
  // Check common proxy headers (set by Vercel, Cloudflare, etc.)
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    // Take first IP if multiple (proxy chain)
    return forwarded.split(',')[0].trim()
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback for development
  return 'unknown'
}
