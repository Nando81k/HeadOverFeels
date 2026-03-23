import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParsedAdminCustomerQuery } from '@/lib/customers/admin-customer-query'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    customer: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    loyaltyTier: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/customer-segments', () => ({
  calculateCustomerSegment: vi.fn((customer: { totalSpent: number }) =>
    customer.totalSpent >= 1000 ? 'VIP' : 'Active'
  ),
}))

function baseQuery(overrides: Partial<ParsedAdminCustomerQuery> = {}): ParsedAdminCustomerQuery {
  return {
    search: '',
    segment: undefined,
    tier: undefined,
    minSpent: undefined,
    minOrders: undefined,
    sortBy: 'createdAt',
    sortDir: 'desc',
    page: 1,
    limit: 20,
    skip: 0,
    ...overrides,
  }
}

function customerRow(id: string, totalSpent: number) {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    phone: null,
    totalSpent,
    totalOrders: 2,
    lastOrderDate: null,
    avgOrderValue: 50,
    createdAt: new Date('2026-03-20T12:00:00.000Z'),
    currentPoints: 20,
    lifetimePoints: 40,
    annualPointsEarned: 30,
    loyaltyTier: {
      id: 'tier-1',
      name: 'Mind',
      slug: 'mind',
    },
  }
}

describe('listAdminCustomers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.loyaltyTier.findMany.mockResolvedValue([
      { id: 'tier-1', name: 'Mind', slug: 'mind' },
    ])
  })

  it('applies segment filtering before pagination', async () => {
    const { listAdminCustomers } = await import('@/lib/customers/admin-customer-service')

    prismaMock.customer.findMany.mockResolvedValue([
      customerRow('c1', 1200),
      customerRow('c2', 900),
      customerRow('c3', 1800),
    ])

    const result = await listAdminCustomers(
      baseQuery({
        segment: 'VIP',
        page: 1,
        limit: 1,
        skip: 0,
      })
    )

    const segmentCall = prismaMock.customer.findMany.mock.calls[0]?.[0] as Record<string, unknown>
    expect(segmentCall).toBeTruthy()
    expect('skip' in segmentCall).toBe(false)
    expect('take' in segmentCall).toBe(false)
    expect(prismaMock.customer.count).not.toHaveBeenCalled()
    expect(result.total).toBe(2)
    expect(result.customers).toHaveLength(1)
    expect(result.customers[0]?.id).toBe('c1')
  })

  it('uses direct db pagination when segment filter is not active', async () => {
    const { listAdminCustomers } = await import('@/lib/customers/admin-customer-service')

    prismaMock.customer.findMany.mockResolvedValue([customerRow('c10', 500)])
    prismaMock.customer.count.mockResolvedValue(11)

    const result = await listAdminCustomers(
      baseQuery({
        page: 2,
        limit: 5,
        skip: 5,
      })
    )

    expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
      })
    )
    expect(prismaMock.customer.count).toHaveBeenCalled()
    expect(result.total).toBe(11)
    expect(result.page).toBe(2)
    expect(result.limit).toBe(5)
  })
})
