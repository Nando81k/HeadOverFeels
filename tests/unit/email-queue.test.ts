import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  emailQueue: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
}))

const senders = vi.hoisted(() => ({
  sendOrderConfirmation: vi.fn(),
  sendShippingNotification: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/email/resend', () => senders)
vi.mock('@prisma/client', () => ({
  EmailQueueStatus: { PENDING: 'PENDING', SENT: 'SENT', FAILED: 'FAILED' },
}))

import { enqueueEmail, processEmailQueue } from '@/lib/email/queue'

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'q1',
    type: 'order-confirmation',
    recipient: 'a@example.com',
    payload: { orderNumber: 'HOF-1' },
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 5,
    nextRetryAt: new Date(0),
    ...overrides,
  }
}

describe('lib/email/queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.emailQueue.update.mockResolvedValue({})
  })

  it('enqueueEmail writes a PENDING row and returns its id', async () => {
    prismaMock.emailQueue.create.mockResolvedValue({ id: 'new-id' })

    const result = await enqueueEmail({
      type: 'order-confirmation',
      recipient: 'a@example.com',
      payload: { orderNumber: 'HOF-1' },
    })

    expect(result).toEqual({ id: 'new-id' })
    expect(prismaMock.emailQueue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'order-confirmation', recipient: 'a@example.com' }),
      })
    )
  })

  it('claims a row atomically before sending and marks it SENT on success', async () => {
    prismaMock.emailQueue.findMany.mockResolvedValue([row()])
    prismaMock.emailQueue.updateMany.mockResolvedValue({ count: 1 })
    senders.sendOrderConfirmation.mockResolvedValue({ id: 'resend-1' })

    const result = await processEmailQueue(10)

    expect(prismaMock.emailQueue.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'q1',
          status: 'PENDING',
          nextRetryAt: { lte: expect.any(Date) },
        }),
      })
    )
    expect(senders.sendOrderConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ orderNumber: 'HOF-1', to: 'a@example.com' })
    )
    expect(prismaMock.emailQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q1' },
        data: expect.objectContaining({ status: 'SENT' }),
      })
    )
    expect(result).toEqual({ processed: 1, sent: 1, failed: 0 })
  })

  it('skips a row another runner already claimed (updateMany count 0)', async () => {
    prismaMock.emailQueue.findMany.mockResolvedValue([row()])
    prismaMock.emailQueue.updateMany.mockResolvedValue({ count: 0 })

    const result = await processEmailQueue(10)

    expect(senders.sendOrderConfirmation).not.toHaveBeenCalled()
    expect(prismaMock.emailQueue.update).not.toHaveBeenCalled()
    expect(result).toEqual({ processed: 1, sent: 0, failed: 0 })
  })

  it('schedules a backoff retry when the send fails below maxAttempts', async () => {
    prismaMock.emailQueue.findMany.mockResolvedValue([row({ attempts: 1 })])
    prismaMock.emailQueue.updateMany.mockResolvedValue({ count: 1 })
    senders.sendOrderConfirmation.mockRejectedValue(new Error('resend down'))

    const result = await processEmailQueue(10)

    expect(prismaMock.emailQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q1' },
        data: expect.objectContaining({
          attempts: 2,
          lastError: 'resend down',
          nextRetryAt: expect.any(Date),
        }),
      })
    )
    expect(result).toEqual({ processed: 1, sent: 0, failed: 0 })
  })

  it('marks the row FAILED once maxAttempts is reached', async () => {
    prismaMock.emailQueue.findMany.mockResolvedValue([row({ attempts: 4, maxAttempts: 5 })])
    prismaMock.emailQueue.updateMany.mockResolvedValue({ count: 1 })
    senders.sendOrderConfirmation.mockRejectedValue(new Error('still down'))

    const result = await processEmailQueue(10)

    expect(prismaMock.emailQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q1' },
        data: expect.objectContaining({ status: 'FAILED', attempts: 5, lastError: 'still down' }),
      })
    )
    expect(result).toEqual({ processed: 1, sent: 0, failed: 1 })
  })

  it('fails rows with no registered sender without retrying', async () => {
    prismaMock.emailQueue.findMany.mockResolvedValue([row({ type: 'cart-recovery' })])
    prismaMock.emailQueue.updateMany.mockResolvedValue({ count: 1 })

    const result = await processEmailQueue(10)

    expect(prismaMock.emailQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      })
    )
    expect(result).toEqual({ processed: 1, sent: 0, failed: 1 })
  })
})
