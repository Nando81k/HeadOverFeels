import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Verify HMAC signature for cron job requests
 * Prevents unauthorized access to cron endpoints
 * 
 * @param request - The Next.js request object
 * @param secret - The shared secret (from CRON_SECRET env var)
 * @returns true if signature is valid, false otherwise
 */
export function verifyCronSignature(request: NextRequest, secret: string): boolean {
  const signature = request.headers.get('x-cron-signature')
  const timestamp = request.headers.get('x-cron-timestamp')

  if (!signature || !timestamp) {
    return false
  }

  // Verify timestamp is within 5 minutes (prevent replay attacks)
  const requestTime = parseInt(timestamp, 10)
  const currentTime = Date.now()
  const timeDifferenceMs = Math.abs(currentTime - requestTime)
  const maxDifferenceMs = 5 * 60 * 1000 // 5 minutes

  if (isNaN(requestTime) || timeDifferenceMs > maxDifferenceMs) {
    console.warn(`Cron request timestamp out of range: ${timeDifferenceMs}ms`)
    return false
  }

  // Calculate HMAC-SHA256 signature
  const message = `${timestamp}:${request.method}`
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')

  // Constant-time comparison to prevent timing attacks
  return secureCompare(signature, expectedSignature)
}

/**
 * Constant-time string comparison
 * Prevents timing attacks by always comparing all characters
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Middleware to verify cron requests
 * Returns error response if verification fails
 */
export function verifyCronRequest(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET

  // CRON_SECRET must be set in production
  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set')
    return NextResponse.json(
      { error: 'Cron secret not configured' },
      { status: 500 }
    )
  }

  if (!verifyCronSignature(request, cronSecret)) {
    console.warn('Invalid cron signature received')
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return null // Verification passed
}

/**
 * Generate HMAC signature for testing cron endpoints
 * Use this to create valid cron requests
 * 
 * @param secret - The CRON_SECRET value
 * @param timestamp - Timestamp to use (defaults to now)
 * @param method - HTTP method (defaults to 'POST')
 * @returns object with signature and timestamp for headers
 */
export function generateCronSignature(secret: string, timestamp?: number, method: string = 'POST') {
  const ts = timestamp || Date.now()
  const message = `${ts}:${method}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')

  return { signature, timestamp: ts.toString() }
}
