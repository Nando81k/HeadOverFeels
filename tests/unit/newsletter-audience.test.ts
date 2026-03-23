import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    newsletterSubscriber: {
      findMany: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
    },
  },
}))

describe('newsletter audience helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds recipients with customer-mode filtering', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { resolveAudienceRecipients } = await import('@/lib/newsletter/audience')

    vi.mocked(prisma.newsletterSubscriber.findMany).mockResolvedValue([
      {
        id: 'sub-1',
        email: 'a@example.com',
        source: 'homepage',
        createdAt: new Date('2026-01-10T00:00:00.000Z'),
      },
      {
        id: 'sub-2',
        email: 'b@example.com',
        source: 'popup',
        createdAt: new Date('2026-01-11T00:00:00.000Z'),
      },
    ] as never)

    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { email: 'a@example.com' },
    ] as never)

    const all = await resolveAudienceRecipients({ customerMode: 'all' })
    const customersOnly = await resolveAudienceRecipients({ customerMode: 'customer' })
    const subscribersOnly = await resolveAudienceRecipients({ customerMode: 'subscriber' })

    expect(all.recipients).toHaveLength(2)
    expect(customersOnly.recipients).toHaveLength(1)
    expect(customersOnly.recipients[0].email).toBe('a@example.com')
    expect(subscribersOnly.recipients).toHaveLength(1)
    expect(subscribersOnly.recipients[0].email).toBe('b@example.com')
  })

  it('applies active/source/date constraints in where clause', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { resolveAudienceRecipients } = await import('@/lib/newsletter/audience')

    vi.mocked(prisma.newsletterSubscriber.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.customer.findMany).mockResolvedValue([] as never)

    await resolveAudienceRecipients({
      activeOnly: true,
      source: 'homepage',
      signupDateFrom: '2026-02-01T00:00:00.000Z',
      signupDateTo: '2026-02-28T23:59:59.000Z',
      customerMode: 'all',
    })

    expect(prisma.newsletterSubscriber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          source: 'homepage',
          createdAt: {
            gte: new Date('2026-02-01T00:00:00.000Z'),
            lte: new Date('2026-02-28T23:59:59.000Z'),
          },
        },
      })
    )
  })
})
