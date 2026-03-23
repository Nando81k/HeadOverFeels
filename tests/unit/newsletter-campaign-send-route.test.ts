import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/admin', () => ({
  verifyAdmin: vi.fn(),
}))

vi.mock('@/lib/newsletter/campaigns', () => ({
  queueCampaignForSend: vi.fn(),
}))

describe('/api/admin/newsletter/campaigns/[id]/send route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queues a draft campaign instead of dispatching inline', async () => {
    const { verifyAdmin } = await import('@/lib/auth/admin')
    const { queueCampaignForSend } = await import('@/lib/newsletter/campaigns')
    const { POST } = await import('@/app/api/admin/newsletter/campaigns/[id]/send/route')

    vi.mocked(verifyAdmin).mockResolvedValue('admin-1')
    vi.mocked(queueCampaignForSend).mockResolvedValue({
      campaignId: 'campaign-1',
      status: 'QUEUED',
    })

    const response = await POST(
      {} as never,
      { params: Promise.resolve({ id: 'campaign-1' }) }
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.campaign.status).toBe('QUEUED')
    expect(queueCampaignForSend).toHaveBeenCalledWith('campaign-1')
  })
})
