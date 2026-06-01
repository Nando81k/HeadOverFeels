import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/fulfillment',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ user: { id: '1', isAdmin: true, name: 'Admin', adminRole: 'ADMIN' } }),
}))

vi.mock('@/components/admin/dashboard/AdminFulfillmentV2', () => ({
  AdminFulfillmentV2: () => <div data-testid="v2">V2 fulfillment</div>,
}))

vi.mock('@/components/admin/_v1/AdminFulfillmentV1', () => ({
  AdminFulfillmentV1: () => <div data-testid="v1">V1 fulfillment</div>,
}))

beforeEach(() => {
  vi.resetModules()
})

describe('admin/fulfillment/page dispatcher', () => {
  it('renders V1 when ADMIN_V2 flag is false', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/fulfillment/page')
    const Page = mod.default
    render(await Page({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('v1')).toBeInTheDocument()
  })

  it('renders V2 when ADMIN_V2 flag is true', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/fulfillment/page')
    const Page = mod.default
    render(await Page({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('v2')).toBeInTheDocument()
  })

  it('passes searchParams through to V2', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const v2Spy = vi.fn(() => <div data-testid="v2-with-params">params received</div>)
    vi.doMock('@/components/admin/dashboard/AdminFulfillmentV2', () => ({
      AdminFulfillmentV2: v2Spy,
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/fulfillment/page')
    const Page = mod.default
    render(await Page({ searchParams: Promise.resolve({ tab: 'returns' }) }))
    expect(screen.getByTestId('v2-with-params')).toBeInTheDocument()
    expect(v2Spy).toHaveBeenCalledWith(
      expect.objectContaining({ searchParams: { tab: 'returns' } }),
      undefined,
    )
  })
})
