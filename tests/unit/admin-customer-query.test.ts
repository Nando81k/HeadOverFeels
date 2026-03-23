import { describe, expect, it } from 'vitest'
import {
  buildAdminCustomersSearchParams,
  getActiveCustomerFilterChips,
  parseAdminCustomerQuery,
} from '@/lib/customers/admin-customer-query'

describe('admin customer query helpers', () => {
  it('parses and sanitizes query params', () => {
    const params = new URLSearchParams({
      page: '-1',
      limit: '9999',
      search: '  alice@example.com  ',
      segment: 'VIP',
      tier: 'tier-1',
      minSpent: '-10',
      minOrders: '4.5',
      sortBy: 'totalSpent',
      sortDir: 'asc',
    })

    const parsed = parseAdminCustomerQuery(params)

    expect(parsed.page).toBe(1)
    expect(parsed.limit).toBe(100)
    expect(parsed.search).toBe('alice@example.com')
    expect(parsed.segment).toBe('VIP')
    expect(parsed.tier).toBe('tier-1')
    expect(parsed.minSpent).toBeUndefined()
    expect(parsed.minOrders).toBe(4)
    expect(parsed.sortBy).toBe('totalSpent')
    expect(parsed.sortDir).toBe('asc')
  })

  it('builds params and active chips from state', () => {
    const filters = {
      search: 'sam',
      segment: 'Active',
      tier: 'tier-2',
      minSpent: '120',
      minOrders: '3',
      sortBy: 'createdAt' as const,
      sortDir: 'desc' as const,
    }

    const params = buildAdminCustomersSearchParams(filters, { page: 2, limit: 20 })
    expect(params.get('page')).toBe('2')
    expect(params.get('limit')).toBe('20')
    expect(params.get('search')).toBe('sam')
    expect(params.get('segment')).toBe('Active')
    expect(params.get('tier')).toBe('tier-2')
    expect(params.get('minSpent')).toBe('120')
    expect(params.get('minOrders')).toBe('3')

    const chips = getActiveCustomerFilterChips(filters)
    expect(chips.map((chip) => chip.key)).toEqual(['search', 'segment', 'tier', 'minSpent', 'minOrders'])
  })
})
