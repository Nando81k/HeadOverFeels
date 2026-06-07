import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Static mocks (available before resetModules) ───────────────────────────

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(async () => ({ userId: 'admin-1', isAdmin: true })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: vi.fn(async () => ({ adminRole: 'SUPER_ADMIN' })),
    },
  },
}))

vi.mock('@/lib/admin/loyalty', () => ({
  loadRewardDetail: vi.fn(async () => ({
    id: 'r1',
    name: '10% off',
    slug: '10-off',
    description: null,
    pointsCost: 500,
    rewardType: 'DISCOUNT',
    value: 10,
    isActive: true,
    maxRedemptionsPerCustomer: null,
    totalAvailable: null,
    totalRedeemed: 0,
    minTierRequired: null,
    metadata: null,
    image: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  loadTiersTab: vi.fn(async () => [
    { id: 't1', name: 'Bronze', slug: 'bronze', description: null, primaryColor: '#000', secondaryColor: '#000', minAnnualSpend: 0, minAnnualPoints: 0, isInviteOnly: false, pointMultiplier: 1, freeShipping: false, earlyDropAccess: false, perks: null, sortOrder: 0, isActive: true, memberCount: 0 },
  ]),
}))

vi.mock('@/components/admin/loyalty/RewardEditor', () => ({
  RewardEditor: (props: Record<string, unknown>) => (
    <div data-testid="reward-editor" data-is-super-admin={String(props.isSuperAdmin)} />
  ),
}))

beforeEach(() => {
  vi.resetModules()
})

afterEach(async () => {
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('app/admin/loyalty/rewards/[id]/edit page dispatcher', () => {
  it('redirects to V1 when ADMIN_V2 flag is off', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const mod = await import('@/app/admin/loyalty/rewards/[id]/edit/page')
    const Page = mod.default
    await expect(
      Page({ params: Promise.resolve({ id: 'r1' }) }),
    ).rejects.toThrow('REDIRECT:/admin/loyalty-v1/rewards/r1/edit')
  })

  it('renders RewardEditor when ADMIN_V2 flag is on', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/loyalty/rewards/[id]/edit/page')
    const Page = mod.default
    render(await Page({ params: Promise.resolve({ id: 'r1' }) }))
    expect(screen.getByTestId('reward-editor')).toBeTruthy()
  })

  it('passes isSuperAdmin=true when session customer has SUPER_ADMIN role', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        customer: { findUnique: vi.fn(async () => ({ adminRole: 'SUPER_ADMIN' })) },
      },
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/loyalty/rewards/[id]/edit/page')
    const Page = mod.default
    render(await Page({ params: Promise.resolve({ id: 'r1' }) }))
    const editor = screen.getByTestId('reward-editor')
    expect(editor.getAttribute('data-is-super-admin')).toBe('true')
  })

  it('passes isSuperAdmin=false when session customer has ADMIN role', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        customer: { findUnique: vi.fn(async () => ({ adminRole: 'ADMIN' })) },
      },
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/loyalty/rewards/[id]/edit/page')
    const Page = mod.default
    render(await Page({ params: Promise.resolve({ id: 'r1' }) }))
    const editor = screen.getByTestId('reward-editor')
    expect(editor.getAttribute('data-is-super-admin')).toBe('false')
  })

  it('calls notFound() when detail is null', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/lib/admin/loyalty', () => ({
      loadRewardDetail: vi.fn(async () => null),
      loadTiersTab: vi.fn(async () => []),
    }))
    const mod = await import('@/app/admin/loyalty/rewards/[id]/edit/page')
    const Page = mod.default
    await expect(
      Page({ params: Promise.resolve({ id: 'nonexistent' }) }),
    ).rejects.toThrow('NOT_FOUND')
  })

  it('falls back to isSuperAdmin=false when session lookup throws', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/lib/auth/session', () => ({
      getSession: vi.fn(async () => { throw new Error('session error') }),
    }))
    vi.doMock('@/lib/admin/loyalty', () => ({
      loadRewardDetail: vi.fn(async () => ({
        id: 'r1', name: '10% off', slug: '10-off', description: null,
        pointsCost: 500, rewardType: 'DISCOUNT', value: 10, isActive: true,
        maxRedemptionsPerCustomer: null, totalAvailable: null, totalRedeemed: 0,
        minTierRequired: null, metadata: null, image: null, sortOrder: 0,
        createdAt: new Date(), updatedAt: new Date(),
      })),
      loadTiersTab: vi.fn(async () => []),
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/loyalty/rewards/[id]/edit/page')
    const Page = mod.default
    render(await Page({ params: Promise.resolve({ id: 'r1' }) }))
    const editor = screen.getByTestId('reward-editor')
    expect(editor.getAttribute('data-is-super-admin')).toBe('false')
  })
})
