import { describe, it, expect } from 'vitest'
import { getRangeBounds } from '@/lib/admin/dashboard'

describe('getRangeBounds', () => {
  it('today returns start of day → now + prior day bounds', () => {
    const ref = new Date('2026-03-04T14:30:00Z')
    const r = getRangeBounds('today', ref)
    expect(r.start.toISOString()).toMatch(/2026-03-04T/)
    expect(r.start.getUTCHours()).toBe(0)
    expect(r.end.getTime()).toBe(ref.getTime())
    expect(r.previousStart.toISOString()).toMatch(/2026-03-03T/)
    expect(r.previousEnd.getTime()).toBe(new Date('2026-03-03T14:30:00Z').getTime())
  })

  it('week returns last 7 days', () => {
    const ref = new Date('2026-03-04T00:00:00Z')
    const r = getRangeBounds('week', ref)
    const diffDays = (r.end.getTime() - r.start.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(7, 0)
  })

  it('month returns last 30 days', () => {
    const ref = new Date('2026-03-04T00:00:00Z')
    const r = getRangeBounds('month', ref)
    const diffDays = (r.end.getTime() - r.start.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(30, 0)
  })

  it('year returns last 365 days', () => {
    const ref = new Date('2026-03-04T00:00:00Z')
    const r = getRangeBounds('year', ref)
    const diffDays = (r.end.getTime() - r.start.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(365, 0)
  })
})
