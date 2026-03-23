import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/newsletter/subscribers', () => ({
  subscribeToNewsletter: vi.fn(),
  unsubscribeFromNewsletter: vi.fn(),
}))

vi.mock('@/lib/security/rateLimit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10, retryAfter: 0 })),
  getClientIdentifier: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn((retryAfter: number) =>
    new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.', retryAfter }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  ),
}))

describe('/api/newsletter route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns idempotent success message for existing subscribers', async () => {
    const { subscribeToNewsletter } = await import('@/lib/newsletter/subscribers')
    const { checkRateLimit } = await import('@/lib/security/rateLimit')
    const { POST } = await import('@/app/api/newsletter/route')

    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 10, retryAfter: 0 })
    vi.mocked(subscribeToNewsletter).mockResolvedValue({
      normalizedEmail: 'test@example.com',
      alreadySubscribed: true,
      reactivated: false,
    })

    const response = await POST({
      json: async () => ({ email: 'test@example.com' }),
    } as never)

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toContain('already subscribed')
  })

  it('ignores bot-like submissions when honeypot is filled', async () => {
    const { subscribeToNewsletter } = await import('@/lib/newsletter/subscribers')
    const { POST } = await import('@/app/api/newsletter/route')

    const response = await POST({
      json: async () => ({ email: 'bot@example.com', honeypot: 'spam' }),
      headers: new Headers(),
    } as never)

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(subscribeToNewsletter).not.toHaveBeenCalled()
  })

  it('returns 429 when subscribe rate limit is exceeded', async () => {
    const { subscribeToNewsletter } = await import('@/lib/newsletter/subscribers')
    const { checkRateLimit } = await import('@/lib/security/rateLimit')
    const { POST } = await import('@/app/api/newsletter/route')

    vi.mocked(checkRateLimit)
      .mockReturnValueOnce({ allowed: false, remaining: 0, retryAfter: 30 })
      .mockReturnValue({ allowed: true, remaining: 10, retryAfter: 0 })

    const response = await POST({
      json: async () => ({ email: 'limited@example.com' }),
      headers: new Headers(),
    } as never)

    expect(response.status).toBe(429)
    expect(subscribeToNewsletter).not.toHaveBeenCalled()
  })

  it('unsubscribes via one-click GET link', async () => {
    const { unsubscribeFromNewsletter } = await import('@/lib/newsletter/subscribers')
    const { GET } = await import('@/app/api/newsletter/route')

    vi.mocked(unsubscribeFromNewsletter).mockResolvedValue({
      normalizedEmail: 'person@example.com',
    })

    const response = await GET({
      url: 'http://localhost/api/newsletter?email=person@example.com&reason=test',
    } as never)

    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('You have been unsubscribed')
    expect(unsubscribeFromNewsletter).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'person@example.com',
        source: 'email_unsubscribe_link',
      })
    )
  })
})
