import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

vi.mock('@/lib/newsletter/campaigns', () => ({
  processQueuedCampaigns: vi.fn(),
}))

describe('/api/cron/newsletter-dispatch route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })

  it('processes queued campaigns when authorized', async () => {
    const { headers } = await import('next/headers')
    const { processQueuedCampaigns } = await import('@/lib/newsletter/campaigns')
    const { POST } = await import('@/app/api/cron/newsletter-dispatch/route')

    vi.mocked(headers).mockResolvedValue(
      new Headers({
        authorization: 'Bearer test-secret',
      }) as never
    )

    vi.mocked(processQueuedCampaigns).mockResolvedValue({
      staleRecovered: 0,
      queuedFound: 1,
      processed: 1,
      succeeded: 1,
      failed: 0,
      results: [
        {
          campaignId: 'camp-1',
          status: 'SENT',
          audienceCount: 10,
          sentCount: 10,
          failedCount: 0,
        },
      ],
    })

    const response = await POST({
      url: 'http://localhost/api/cron/newsletter-dispatch?limit=2',
    } as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(processQueuedCampaigns).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 2,
      })
    )
  })
})
