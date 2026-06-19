import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/customers',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ user: { id: '1', isAdmin: true, name: 'Admin', adminRole: 'ADMIN' } }),
}))

beforeEach(() => {
  vi.resetModules()
})

describe('app/admin/customers/page (dispatcher)', () => {
  it('renders V1 stub when NEXT_PUBLIC_ADMIN_V2_ENABLED is not "true"', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    vi.doMock('@/components/admin/_v1/AdminCustomersV1', () => ({
      AdminCustomersV1: () => <div data-testid="v1">V1</div>,
    }))
    vi.doMock('@/components/admin/dashboard/AdminCustomersV2', () => ({
      AdminCustomersV2: () => <div data-testid="v2">V2</div>,
    }))
    vi.doMock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
    vi.doMock('@/lib/prisma', () => ({ prisma: { customer: { findUnique: vi.fn() } } }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/customers/page')
    render(await mod.default({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('v1')).toBeInTheDocument()
  })

  it('renders V2 root when flag is "true"', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/components/admin/_v1/AdminCustomersV1', () => ({
      AdminCustomersV1: () => <div data-testid="v1">V1</div>,
    }))
    vi.doMock('@/components/admin/dashboard/AdminCustomersV2', () => ({
      AdminCustomersV2: () => <div data-testid="v2">V2</div>,
    }))
    vi.doMock('@/lib/auth/session', () => ({
      getSession: vi.fn().mockResolvedValue({ userId: 'u1', isAdmin: true }),
    }))
    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        customer: { findUnique: vi.fn().mockResolvedValue({ adminRole: 'SUPER_ADMIN' }) },
      },
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/customers/page')
    render(await mod.default({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('v2')).toBeInTheDocument()
  })
})
