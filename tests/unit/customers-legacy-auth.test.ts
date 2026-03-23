import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { verifyAdminMock } = vi.hoisted(() => ({
  verifyAdminMock: vi.fn(),
}))

vi.mock('@/lib/auth/admin', () => ({
  verifyAdmin: verifyAdminMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: vi.fn(),
    },
    customerNote: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

function createRequest(url: string): NextRequest {
  return { url, json: async () => ({ content: 'Note' }) } as unknown as NextRequest
}

describe('legacy /api/customers* admin auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyAdminMock.mockResolvedValue(null)
  })

  it('requires admin auth for legacy list route', async () => {
    const { GET } = await import('@/app/api/customers/route')
    const response = await GET(createRequest('http://localhost/api/customers'))
    expect(response.status).toBe(401)
  })

  it('requires admin auth for legacy customer detail route', async () => {
    const { GET } = await import('@/app/api/customers/[id]/route')
    const response = await GET(createRequest('http://localhost/api/customers/c1'), {
      params: Promise.resolve({ id: 'c1' }),
    })
    expect(response.status).toBe(401)
  })

  it('requires admin auth for legacy notes route', async () => {
    const { POST } = await import('@/app/api/customers/[id]/notes/route')
    const response = await POST(createRequest('http://localhost/api/customers/c1/notes'), {
      params: Promise.resolve({ id: 'c1' }),
    })
    expect(response.status).toBe(401)
  })
})
