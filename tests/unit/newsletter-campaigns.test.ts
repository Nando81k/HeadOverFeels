import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    newsletterCampaign: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    newsletterCampaignDelivery: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock('@/lib/newsletter/audience', () => ({
  resolveAudienceRecipients: vi.fn(),
}))

vi.mock('@/lib/email/newsletter', () => ({
  sendNewsletterEmail: vi.fn(),
}))

describe('dispatchCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends in batches and persists sent/failed aggregates', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { resolveAudienceRecipients } = await import('@/lib/newsletter/audience')
    const { sendNewsletterEmail } = await import('@/lib/email/newsletter')
    const { dispatchCampaign } = await import('@/lib/newsletter/campaigns')

    vi.mocked(prisma.newsletterCampaign.findUnique).mockResolvedValue({
      id: 'camp-1',
      status: 'QUEUED',
      subject: 'Drop update',
      preheader: 'Preview',
      heroImageUrl: null,
      ctaLabel: 'Shop',
      ctaUrl: 'https://headoverfeels.com/products',
      bodyMarkdown: 'Body',
      audienceFilter: { activeOnly: true, customerMode: 'all' },
    } as never)

    vi.mocked(prisma.newsletterCampaign.updateMany).mockResolvedValue({ count: 1 } as never)

    vi.mocked(resolveAudienceRecipients).mockResolvedValue({
      filter: {
        activeOnly: true,
        source: null,
        signupDateFrom: null,
        signupDateTo: null,
        customerMode: 'all',
      },
      recipients: [
        {
          subscriberId: 'sub-1',
          email: 'a@example.com',
          source: 'homepage',
          createdAt: new Date('2026-03-20T00:00:00.000Z'),
          isCustomer: true,
        },
        {
          subscriberId: 'sub-2',
          email: 'b@example.com',
          source: 'popup',
          createdAt: new Date('2026-03-20T00:00:00.000Z'),
          isCustomer: false,
        },
      ],
    })

    vi.mocked(sendNewsletterEmail)
      .mockResolvedValueOnce({ success: true, messageId: 'msg-1', error: null } as never)
      .mockResolvedValueOnce({ success: false, messageId: null, error: 'Temporary failure' } as never)

    const result = await dispatchCampaign('camp-1')

    expect(result).toEqual({
      audienceCount: 2,
      sentCount: 1,
      failedCount: 1,
      status: 'FAILED',
    })

    expect(prisma.newsletterCampaignDelivery.upsert).toHaveBeenCalledTimes(2)
    expect(prisma.newsletterCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'camp-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          audienceCount: 2,
          sentCount: 1,
          failedCount: 1,
        }),
      })
    )
  })

  it('throws when campaign is not in draft state', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { dispatchCampaign } = await import('@/lib/newsletter/campaigns')

    vi.mocked(prisma.newsletterCampaign.findUnique).mockResolvedValue({
      id: 'camp-2',
      status: 'SENT',
      subject: 'Sent already',
      preheader: null,
      heroImageUrl: null,
      ctaLabel: null,
      ctaUrl: null,
      bodyMarkdown: 'body',
      audienceFilter: null,
    } as never)

    await expect(dispatchCampaign('camp-2')).rejects.toThrow('Only queued campaigns can be dispatched')
    expect(prisma.newsletterCampaign.updateMany).not.toHaveBeenCalled()
  })

  it('queues a draft campaign for background dispatch', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { queueCampaignForSend } = await import('@/lib/newsletter/campaigns')

    vi.mocked(prisma.newsletterCampaign.findUnique).mockResolvedValue({
      id: 'camp-3',
      status: 'DRAFT',
    } as never)
    vi.mocked(prisma.newsletterCampaign.updateMany).mockResolvedValue({ count: 1 } as never)

    const result = await queueCampaignForSend('camp-3')

    expect(result).toEqual({
      campaignId: 'camp-3',
      status: 'QUEUED',
    })
    expect(prisma.newsletterCampaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'camp-3',
          status: 'DRAFT',
        },
        data: expect.objectContaining({
          status: 'QUEUED',
        }),
      })
    )
  })

  it('processes queued campaigns and reports worker summary', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { resolveAudienceRecipients } = await import('@/lib/newsletter/audience')
    const { sendNewsletterEmail } = await import('@/lib/email/newsletter')
    const { processQueuedCampaigns } = await import('@/lib/newsletter/campaigns')

    vi.mocked(prisma.newsletterCampaign.updateMany)
      // stale SENDING recovery
      .mockResolvedValueOnce({ count: 1 } as never)
      // lock QUEUED -> SENDING
      .mockResolvedValueOnce({ count: 1 } as never)

    vi.mocked(prisma.newsletterCampaign.findMany).mockResolvedValue([
      { id: 'camp-worker-1' },
    ] as never)

    vi.mocked(prisma.newsletterCampaign.findUnique).mockResolvedValue({
      id: 'camp-worker-1',
      status: 'QUEUED',
      subject: 'Queued campaign',
      preheader: null,
      heroImageUrl: null,
      ctaLabel: null,
      ctaUrl: null,
      bodyMarkdown: 'Body',
      audienceFilter: { activeOnly: true, customerMode: 'all' },
    } as never)

    vi.mocked(resolveAudienceRecipients).mockResolvedValue({
      filter: {
        activeOnly: true,
        source: null,
        signupDateFrom: null,
        signupDateTo: null,
        customerMode: 'all',
      },
      recipients: [
        {
          subscriberId: 'sub-worker-1',
          email: 'worker@example.com',
          source: 'homepage',
          createdAt: new Date('2026-03-20T00:00:00.000Z'),
          isCustomer: true,
        },
      ],
    })

    vi.mocked(sendNewsletterEmail).mockResolvedValue({
      success: true,
      messageId: 'msg-worker',
      error: null,
    } as never)

    const result = await processQueuedCampaigns({ limit: 1 })

    expect(result).toEqual(
      expect.objectContaining({
        staleRecovered: 1,
        queuedFound: 1,
        processed: 1,
        succeeded: 1,
        failed: 0,
      })
    )
    expect(prisma.newsletterCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'camp-worker-1' },
        data: expect.objectContaining({
          status: 'SENT',
        }),
      })
    )
  })
})
