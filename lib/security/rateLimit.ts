import { NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ---------------------------------------------------------------------------
// In-memory fallback (local dev only — used when KV env vars are not set)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Local-dev-only fallback: fixed-window rate limiter backed by process memory.
 *
 * WARNING: This is NOT suitable for production. On Vercel every serverless
 * function invocation has its own memory, so counters are per-instance.
 * This path is only taken when KV env vars are absent (e.g. `npm run dev`
 * without a linked KV store).
 */
function inMemoryFallback(
  identifier: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  // Probabilistic cleanup to prevent unbounded memory growth (1% of calls)
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

// ---------------------------------------------------------------------------
// Distributed rate limiter — Upstash Redis + @upstash/ratelimit
// ---------------------------------------------------------------------------

/**
 * Cache Ratelimit instances keyed by "max:windowMs" so we don't re-create one
 * per request (each construction opens a Redis connection pool).
 */
const limiterCache = new Map<string, Ratelimit>()

function getLimiter(max: number, windowMs: number): Ratelimit {
  const cacheKey = `${max}:${windowMs}`
  let limiter = limiterCache.get(cacheKey)

  if (!limiter) {
    const redis = new Redis({
      url:
        process.env.UPSTASH_REDIS_REST_URL ??
        process.env.KV_REST_API_URL ??
        '',
      token:
        process.env.UPSTASH_REDIS_REST_TOKEN ??
        process.env.KV_REST_API_TOKEN ??
        '',
    })

    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
      analytics: false,
      prefix: 'hof:rl',
    })

    limiterCache.set(cacheKey, limiter)
  }

  return limiter
}

// ---------------------------------------------------------------------------
// Public API — signature must remain identical to the previous implementation
// ---------------------------------------------------------------------------

/**
 * Check rate limit for an identifier.
 *
 * Uses a distributed sliding-window limiter backed by Upstash Redis when the
 * `UPSTASH_REDIS_REST_URL` (or legacy `KV_REST_API_URL`) environment variable
 * is set. Falls back to an in-memory limiter for local development.
 *
 * @param identifier  - IP address, user ID, or email
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs    - Time window in milliseconds
 * @returns `{ allowed, remaining, retryAfter }`
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000,
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  // Fallback: if KV env vars aren't configured, use the in-memory limiter so
  // local development still works without a Redis instance.
  const kvUrl =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  if (!kvUrl) {
    return inMemoryFallback(identifier, maxRequests, windowMs)
  }

  const limiter = getLimiter(maxRequests, windowMs)
  const { success, remaining, reset } = await limiter.limit(identifier)

  const nowSec = Math.floor(Date.now() / 1000)
  const resetSec = Math.floor(reset / 1000)
  const retryAfter = success ? 0 : Math.max(0, resetSec - nowSec)

  return { allowed: success, remaining, retryAfter }
}

// ---------------------------------------------------------------------------
// Helpers (re-exported, API unchanged)
// ---------------------------------------------------------------------------

/**
 * Rate limit response helper.
 * Returns a 429 Too Many Requests response with proper headers.
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
    },
  )
}

/**
 * Common rate limit configurations.
 */
export const RATE_LIMITS = {
  // Auth endpoints: 20 attempts per minute per IP in dev, 5 in production
  auth: { maxRequests: process.env.NODE_ENV === 'development' ? 20 : 5, windowMs: 60000 },
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
 * Get client identifier (IP address) from request headers.
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
