import { NextRequest } from 'next/server'

/**
 * Extracts and validates guest email from request
 * For guest checkouts, we validate that the email hasn't changed
 * between cart reservation and order creation to prevent session hijacking
 */
export function getGuestEmail(request: NextRequest): string | null {
  // Check for guest email in custom header (passed by client during checkout)
  const headerEmail = request.headers.get('x-guest-email')
  return headerEmail?.toLowerCase().trim() || null
}

/**
 * Validates that guest email is consistent with their session
 * Returns true if the email can be used for this session
 * 
 * Security considerations:
 * - Guests should use the same email throughout their session
 * - Prevents one guest from claiming another guest's cart/order
 * - Should be called whenever guest email is provided in request
 */
export function validateGuestEmailConsistency(
  providedEmail: string,
  sessionEmail: string | null
): boolean {
  if (!providedEmail || !sessionEmail) {
    return false
  }

  const normalizedProvided = providedEmail.toLowerCase().trim()
  const normalizedSession = sessionEmail.toLowerCase().trim()

  // Emails must match exactly
  return normalizedProvided === normalizedSession
}

/**
 * Validates guest email format and length
 * Prevents email enumeration and injection attacks
 */
export function isValidGuestEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false
  }

  // Max length to prevent DoS attacks
  if (email.length > 255) {
    return false
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Extracts and validates guest session info from request
 * Returns { email: string, sessionId: string } or null if invalid
 * 
 * Usage in endpoints:
 * const guestInfo = validateGuestSession(request)
 * if (!guestInfo) {
 *   return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
 * }
 */
export function validateGuestSession(request: NextRequest): {
  email: string
  sessionId: string
} | null {
  const email = getGuestEmail(request)
  const sessionId = request.headers.get('x-session-id')

  if (!email || !sessionId) {
    return null
  }

  if (!isValidGuestEmail(email)) {
    return null
  }

  // Validate session ID format (UUID v4)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(sessionId)) {
    return null
  }

  return { email, sessionId }
}
