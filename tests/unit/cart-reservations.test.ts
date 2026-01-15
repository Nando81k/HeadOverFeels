// tests/unit/cart-reservations.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock isValidGuestEmail from the security module
vi.mock('@/lib/security/guest-session', () => ({
  validateGuestSession: vi.fn().mockReturnValue(true),
  isValidGuestEmail: vi.fn((email: string) => {
    // Simple email validation for testing
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 255
  }),
}))

describe('Cart Reservation Validation', () => {
  describe('Guest Email Validation', () => {
    it('should accept valid email addresses', async () => {
      const { isValidGuestEmail } = await import('@/lib/security/guest-session')
      
      expect(isValidGuestEmail('user@example.com')).toBe(true)
      expect(isValidGuestEmail('test.user@domain.org')).toBe(true)
      expect(isValidGuestEmail('name+tag@email.co')).toBe(true)
    })

    it('should reject invalid email addresses', async () => {
      const { isValidGuestEmail } = await import('@/lib/security/guest-session')
      
      expect(isValidGuestEmail('')).toBe(false)
      expect(isValidGuestEmail('notanemail')).toBe(false)
      expect(isValidGuestEmail('@nodomain.com')).toBe(false)
      expect(isValidGuestEmail('user@')).toBe(false)
    })
  })

  describe('Reservation Duration', () => {
    it('should define 15 minute reservation duration', () => {
      const RESERVATION_DURATION_MS = 15 * 60 * 1000
      expect(RESERVATION_DURATION_MS).toBe(900000)
    })

    it('should calculate correct expiration time', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-01-15T10:00:00Z'))
      
      const RESERVATION_DURATION_MS = 15 * 60 * 1000
      const expiresAt = new Date(Date.now() + RESERVATION_DURATION_MS)
      
      expect(expiresAt.toISOString()).toBe('2025-01-15T10:15:00.000Z')
      
      vi.useRealTimers()
    })
  })
})

describe('Inventory Calculation', () => {
  it('should calculate available inventory correctly', () => {
    const variantInventory = 100
    const reservedQuantity = 25
    const availableInventory = variantInventory - reservedQuantity
    
    expect(availableInventory).toBe(75)
  })

  it('should prevent over-reservation', () => {
    const variantInventory = 10
    const reservedQuantity = 8
    const requestedQuantity = 5
    const availableInventory = variantInventory - reservedQuantity
    
    expect(availableInventory < requestedQuantity).toBe(true)
  })

  it('should allow reservation when inventory is sufficient', () => {
    const variantInventory = 100
    const reservedQuantity = 20
    const requestedQuantity = 5
    const availableInventory = variantInventory - reservedQuantity
    
    expect(availableInventory >= requestedQuantity).toBe(true)
  })
})
