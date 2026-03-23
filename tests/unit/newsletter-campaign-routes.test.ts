import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/admin', () => ({
  verifyAdmin: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    newsletterCampaign: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/newsletter/audience', () => ({
  getAudienceCount: vi.fn(),
}))

vi.mock('@/lib/newsletter/campaigns', () => ({
  parseCampaignContentInput: vi.fn(),
  parseStoredAudienceFilter: vi.fn(),
  serializeAudienceFilter: vi.fn(),
}))

describe('/api/admin/newsletter/campaigns/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks updates when campaign is not a draft', async () => {
    const { verifyAdmin } = await import('@/lib/auth/admin')
    const { prisma } = await import('@/lib/prisma')
    const { PATCH } = await import('@/app/api/admin/newsletter/campaigns/[id]/route')

    vi.mocked(verifyAdmin).mockResolvedValue('admin-1')
    vi.mocked(prisma.newsletterCampaign.findUnique).mockResolvedValue({
      id: 'campaign-1',
      status: 'SENT',
      name: 'Sent Campaign',
      subject: 'Subject',
      preheader: null,
      heroImageUrl: null,
      ctaLabel: null,
      ctaUrl: null,
      bodyMarkdown: 'Body',
      audienceFilter: null,
    } as never)

    const response = await PATCH(
      {
        json: async () => ({ subject: 'Cannot update' }),
      } as never,
      { params: Promise.resolve({ id: 'campaign-1' }) }
    )

    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Only draft campaigns can be edited')
    expect(prisma.newsletterCampaign.update).not.toHaveBeenCalled()
  })
})
