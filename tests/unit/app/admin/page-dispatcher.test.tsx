import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ user: { id: '1', isAdmin: true, name: 'Admin', adminRole: 'ADMIN' } }),
}))

vi.mock('@/components/admin/dashboard/AdminDashboardV2', () => ({
  AdminDashboardV2: () => <div data-testid="v2">V2 dashboard</div>,
}))

vi.mock('@/components/admin/_v1/AdminDashboardV1', () => ({
  AdminDashboardV1: () => <div data-testid="v1">V1 dashboard</div>,
}))

beforeEach(() => {
  vi.resetModules()
})

describe('admin/page dispatcher', () => {
  it('renders V1 when ADMIN_V2 flag is false', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/page')
    const Page = mod.default
    render(await Page({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('v1')).toBeInTheDocument()
  })

  it('renders V2 when ADMIN_V2 flag is true', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/page')
    const Page = mod.default
    render(await Page({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('v2')).toBeInTheDocument()
  })
})
