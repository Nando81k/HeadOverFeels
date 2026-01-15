// tests/unit/drops.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDropStatus, type ActiveDrop } from '@/lib/drops'

describe('Drop Status Logic', () => {
  const createMockDrop = (overrides: Partial<ActiveDrop> = {}): ActiveDrop => ({
    id: 'test-drop-id',
    name: 'Test Drop',
    slug: 'test-drop',
    description: 'A test drop',
    price: 99.99,
    compareAtPrice: 149.99,
    images: ['/test.jpg'],
    releaseDate: null,
    dropEndDate: null,
    maxQuantity: 100,
    variants: [{ inventory: 50 }],
    ...overrides,
  })

  describe('getDropStatus', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('should return "upcoming" when releaseDate is null', () => {
      const drop = createMockDrop({ releaseDate: null, dropEndDate: null })
      expect(getDropStatus(drop)).toBe('upcoming')
    })

    it('should return "upcoming" when dropEndDate is null', () => {
      const drop = createMockDrop({ 
        releaseDate: new Date('2025-01-01'),
        dropEndDate: null 
      })
      expect(getDropStatus(drop)).toBe('upcoming')
    })

    it('should return "upcoming" when current time is before releaseDate', () => {
      vi.setSystemTime(new Date('2025-01-01T10:00:00Z'))
      
      const drop = createMockDrop({
        releaseDate: new Date('2025-01-02T10:00:00Z'),
        dropEndDate: new Date('2025-01-05T10:00:00Z'),
      })
      
      expect(getDropStatus(drop)).toBe('upcoming')
    })

    it('should return "live" when current time is between releaseDate and dropEndDate', () => {
      vi.setSystemTime(new Date('2025-01-03T10:00:00Z'))
      
      const drop = createMockDrop({
        releaseDate: new Date('2025-01-02T10:00:00Z'),
        dropEndDate: new Date('2025-01-05T10:00:00Z'),
      })
      
      expect(getDropStatus(drop)).toBe('live')
    })

    it('should return "live" when current time equals releaseDate', () => {
      vi.setSystemTime(new Date('2025-01-02T10:00:00Z'))
      
      const drop = createMockDrop({
        releaseDate: new Date('2025-01-02T10:00:00Z'),
        dropEndDate: new Date('2025-01-05T10:00:00Z'),
      })
      
      expect(getDropStatus(drop)).toBe('live')
    })

    it('should return "live" when current time equals dropEndDate', () => {
      vi.setSystemTime(new Date('2025-01-05T10:00:00Z'))
      
      const drop = createMockDrop({
        releaseDate: new Date('2025-01-02T10:00:00Z'),
        dropEndDate: new Date('2025-01-05T10:00:00Z'),
      })
      
      expect(getDropStatus(drop)).toBe('live')
    })

    it('should return "past" when current time is after dropEndDate', () => {
      vi.setSystemTime(new Date('2025-01-06T10:00:00Z'))
      
      const drop = createMockDrop({
        releaseDate: new Date('2025-01-02T10:00:00Z'),
        dropEndDate: new Date('2025-01-05T10:00:00Z'),
      })
      
      expect(getDropStatus(drop)).toBe('past')
    })
  })
})
