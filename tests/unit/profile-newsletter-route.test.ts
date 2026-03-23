import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/newsletter/subscribers', () => ({
  subscribeToNewsletter: vi.fn(),
  unsubscribeFromNewsletter: vi.fn(),
}))

describe('/api/profile/newsletter route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('subscribes authenticated user via canonical subscriber flow', async () => {
    const { auth } = await import('@/lib/auth/auth')
    const { prisma } = await import('@/lib/prisma')
    const { subscribeToNewsletter } = await import('@/lib/newsletter/subscribers')
    const { PUT } = await import('@/app/api/profile/newsletter/route')

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'person@example.com' },
    } as never)

    vi.mocked(prisma.customer.findUnique)
      .mockResolvedValueOnce({ email: 'person@example.com' } as never)
      .mockResolvedValueOnce({ newsletter: true } as never)

    vi.mocked(prisma.customer.findFirst).mockResolvedValue({
      id: 'customer-1',
      email: 'person@example.com',
      newsletter: false,
    } as never)

    const response = await PUT({
      cookies: { get: () => undefined },
      json: async () => ({ subscribed: true }),
    } as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.subscribed).toBe(true)
    expect(subscribeToNewsletter).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'person@example.com',
      })
    )
  })

  it('unsubscribes authenticated user via canonical subscriber flow', async () => {
    const { auth } = await import('@/lib/auth/auth')
    const { prisma } = await import('@/lib/prisma')
    const { unsubscribeFromNewsletter } = await import('@/lib/newsletter/subscribers')
    const { PUT } = await import('@/app/api/profile/newsletter/route')

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'person@example.com' },
    } as never)

    vi.mocked(prisma.customer.findUnique)
      .mockResolvedValueOnce({ email: 'person@example.com' } as never)
      .mockResolvedValueOnce({ newsletter: false } as never)

    vi.mocked(prisma.customer.findFirst).mockResolvedValue({
      id: 'customer-1',
      email: 'person@example.com',
      newsletter: true,
    } as never)

    const response = await PUT({
      cookies: { get: () => undefined },
      json: async () => ({ subscribed: false }),
    } as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.subscribed).toBe(false)
    expect(unsubscribeFromNewsletter).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'person@example.com',
      })
    )
  })
})
