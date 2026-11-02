// tests/unit/storefront/early-access.test.ts — lib/storefront/early-access.ts (Phase 5, Task 1)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { prisma, bridge, customerEnv } = vi.hoisted(() => ({
  prisma: {
    customer: { findUnique: vi.fn() },
    earlyAccessGrant: { findFirst: vi.fn() },
  },
  bridge: { resolveCustomer: vi.fn() },
  customerEnv: { hasCustomerAccountEnv: vi.fn(() => true) },
}))
vi.mock('@/lib/prisma', () => ({ prisma }))
vi.mock('@/lib/loyalty/shopify-bridge', () => bridge)
vi.mock('@/lib/shopify/customer/env', () => customerEnv)

import type { CustomerSession } from '@/lib/shopify/customer/session'
import { customerHasEarlyAccess, hasEarlyAccess } from '@/lib/storefront/early-access'

const NOW = new Date('2026-09-10T12:00:00Z')
const session: CustomerSession = {
  tokens: { accessToken: 'at', refreshToken: 'rt', idToken: null, expiresAt: Date.now() + 60_000 },
  customerId: 'gid://shopify/Customer/1',
  email: 'nando@example.com',
  firstName: 'Nando',
  lastName: 'R',
}

beforeEach(() => {
  vi.clearAllMocks()
  customerEnv.hasCustomerAccountEnv.mockReturnValue(true)
  bridge.resolveCustomer.mockResolvedValue({ id: 'cus_1', created: false })
  prisma.customer.findUnique.mockResolvedValue({ loyaltyTier: { earlyDropAccess: false } })
  prisma.earlyAccessGrant.findFirst.mockResolvedValue(null)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('customerHasEarlyAccess', () => {
  it('is true when the tier grants early access, without reading grants', async () => {
    prisma.customer.findUnique.mockResolvedValue({ loyaltyTier: { earlyDropAccess: true } })

    await expect(customerHasEarlyAccess('cus_1', 'drop-01', NOW)).resolves.toBe(true)
    expect(prisma.earlyAccessGrant.findFirst).not.toHaveBeenCalled()
  })

  it('is true for a valid grant on the product with that handle', async () => {
    prisma.earlyAccessGrant.findFirst.mockResolvedValue({ id: 'grant_1' })

    await expect(customerHasEarlyAccess('cus_1', 'drop-01', NOW)).resolves.toBe(true)
    expect(prisma.earlyAccessGrant.findFirst).toHaveBeenCalledWith({
      where: { customerId: 'cus_1', product: { slug: 'drop-01' }, validUntil: { gt: NOW } },
      select: { id: true },
    })
  })

  it('is false with no tier flag and no grant (or an expired one, which the query excludes)', async () => {
    await expect(customerHasEarlyAccess('cus_1', 'drop-01', NOW)).resolves.toBe(false)
    prisma.customer.findUnique.mockResolvedValue(null)
    await expect(customerHasEarlyAccess('cus_1', 'drop-01', NOW)).resolves.toBe(false)
  })
})

describe('hasEarlyAccess', () => {
  it('is false signed out or with accounts unconfigured, without touching Prisma', async () => {
    await expect(hasEarlyAccess(null, 'drop-01', NOW)).resolves.toBe(false)
    customerEnv.hasCustomerAccountEnv.mockReturnValue(false)
    await expect(hasEarlyAccess(session, 'drop-01', NOW)).resolves.toBe(false)
    expect(bridge.resolveCustomer).not.toHaveBeenCalled()
    expect(prisma.customer.findUnique).not.toHaveBeenCalled()
  })

  it('resolves the Prisma customer behind the session and checks access', async () => {
    prisma.earlyAccessGrant.findFirst.mockResolvedValue({ id: 'grant_1' })

    await expect(hasEarlyAccess(session, 'drop-01', NOW)).resolves.toBe(true)
    expect(bridge.resolveCustomer).toHaveBeenCalledWith({
      shopifyCustomerId: session.customerId,
      email: session.email,
      firstName: 'Nando',
      lastName: 'R',
    })
  })

  it('fails closed and logs the message when Prisma throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    prisma.customer.findUnique.mockRejectedValue(new Error('db down'))

    await expect(hasEarlyAccess(session, 'drop-01', NOW)).resolves.toBe(false)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('db down'))
  })
})
