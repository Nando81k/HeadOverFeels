// tests/unit/back-in-stock-send.test.ts — lib/back-in-stock/send.ts (shared sender, Phase 5)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { resend } = vi.hoisted(() => ({ resend: { send: vi.fn() } }))
vi.mock('resend', () => ({ Resend: class { emails = resend } }))
vi.mock('@react-email/components', () => ({ render: vi.fn(async () => '<html/>') }))
vi.mock('@/emails/BackInStock', () => ({ default: (props: unknown) => props }))

import { emailProductName, isBackInStockEmailConfigured, resetBackInStockEmailClient, sendBackInStockEmail } from '@/lib/back-in-stock/send'

const input = {
  to: 'a@b.co',
  productTitle: 'Core Hoodie',
  variantTitle: 'M / Black',
  productUrl: 'https://x/products/core-hoodie',
  unsubscribeUrl: 'https://x/u',
}

beforeEach(() => {
  vi.clearAllMocks()
  resetBackInStockEmailClient()
  process.env.RESEND_API_KEY = 're_test'
  resend.send.mockResolvedValue({ error: null })
})
afterEach(() => {
  delete process.env.RESEND_API_KEY
  resetBackInStockEmailClient()
})

describe('sendBackInStockEmail', () => {
  it('names the variant in the subject and sends through Resend', async () => {
    await expect(sendBackInStockEmail(input)).resolves.toEqual({ ok: true })
    expect(resend.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@b.co', subject: 'Core Hoodie — M / Black is back in stock', html: '<html/>' }))
  })

  it('reports a missing key, a provider error and a thrown error without throwing', async () => {
    delete process.env.RESEND_API_KEY
    resetBackInStockEmailClient()
    expect(isBackInStockEmailConfigured()).toBe(false)
    await expect(sendBackInStockEmail(input)).resolves.toMatchObject({ ok: false })
    process.env.RESEND_API_KEY = 're_test'
    resetBackInStockEmailClient()
    resend.send.mockResolvedValue({ error: { message: 'bounced' } })
    await expect(sendBackInStockEmail(input)).resolves.toEqual({ ok: false, error: 'bounced' })
    resend.send.mockRejectedValue(new Error('network'))
    await expect(sendBackInStockEmail(input)).resolves.toEqual({ ok: false, error: 'network' })
  })

  it('emailProductName skips the placeholder variant title', () => {
    expect(emailProductName('Cap', 'Default Title')).toBe('Cap')
    expect(emailProductName('Cap', null)).toBe('Cap')
    expect(emailProductName('Cap', 'One size')).toBe('Cap — One size')
  })
})
