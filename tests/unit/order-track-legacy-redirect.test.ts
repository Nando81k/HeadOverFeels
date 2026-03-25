import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

import LegacyOrderTrackPage from '@/app/order/track/[id]/page'

describe('Legacy order tracking route redirect', () => {
  beforeEach(() => {
    redirectMock.mockReset()
  })

  it('redirects /order/track/:id to /orders/:id/track', async () => {
    await LegacyOrderTrackPage({ params: Promise.resolve({ id: 'ord_123' }) })

    expect(redirectMock).toHaveBeenCalledTimes(1)
    expect(redirectMock).toHaveBeenCalledWith('/orders/ord_123/track')
  })
})
