import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { verifyAdminMock, listAdminCustomersMock } = vi.hoisted(() => ({
  verifyAdminMock: vi.fn(),
  listAdminCustomersMock: vi.fn(),
}))

vi.mock('@/lib/auth/admin', () => ({
  verifyAdmin: verifyAdminMock,
}))

vi.mock('@/lib/customers/admin-customer-service', () => ({
  listAdminCustomers: listAdminCustomersMock,
}))

function createRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest
}

describe('GET /api/admin/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when requester is not admin', async () => {
    const { GET } = await import('@/app/api/admin/customers/route')
    verifyAdminMock.mockResolvedValue(null)

    const response = await GET(createRequest('http://localhost/api/admin/customers?page=1'))
    expect(response.status).toBe(401)
  })

  it('returns canonical paginated data when authorized', async () => {
    const { GET } = await import('@/app/api/admin/customers/route')
    verifyAdminMock.mockResolvedValue('admin-1')
    listAdminCustomersMock.mockResolvedValue({
      customers: [{ id: 'c1', email: 'a@example.com' }],
      total: 1,
      page: 1,
      limit: 20,
      tiers: [{ id: 'tier-1', name: 'Mind', slug: 'mind' }],
    })

    const response = await GET(
      createRequest('http://localhost/api/admin/customers?segment=VIP&sortBy=totalSpent')
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(listAdminCustomersMock).toHaveBeenCalled()
    expect(payload).toMatchObject({
      data: [{ id: 'c1', email: 'a@example.com' }],
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
      tiers: [{ id: 'tier-1', name: 'Mind', slug: 'mind' }],
    })
  })
})
