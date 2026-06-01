import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/marketing',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ user: { id: '1', isAdmin: true, name: 'Admin', adminRole: 'ADMIN' } }),
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

vi.mock('@/components/admin/dashboard/AdminMarketingV2', () => ({
  AdminMarketingV2: () => <div data-testid="v2">V2 marketing</div>,
}))

vi.mock('@/components/admin/_v1/AdminMarketingV1', () => ({
  AdminMarketingV1: () => <div data-testid="v1">V1 marketing</div>,
}))

beforeEach(() => {
  vi.resetModules()
})

describe('admin/marketing/page dispatcher', () => {
  it('renders V1 when ADMIN_V2 flag is false', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/marketing/page')
    const Page = mod.default
    render(await Page({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('v1')).toBeInTheDocument()
  })

  it('renders V2 when ADMIN_V2 flag is true', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/marketing/page')
    const Page = mod.default
    render(await Page({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('v2')).toBeInTheDocument()
  })

  it('passes searchParams through to V2 and forwards isSuperAdmin', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const v2Spy = vi.fn(() => <div data-testid="v2-with-params">params received</div>)
    vi.doMock('@/components/admin/dashboard/AdminMarketingV2', () => ({
      AdminMarketingV2: v2Spy,
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/marketing/page')
    const Page = mod.default
    render(await Page({ searchParams: Promise.resolve({ tab: 'subscribers' }) }))
    expect(screen.getByTestId('v2-with-params')).toBeInTheDocument()
    expect(v2Spy).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: { tab: 'subscribers' },
        isSuperAdmin: true,
      }),
      undefined,
    )
  })
})
