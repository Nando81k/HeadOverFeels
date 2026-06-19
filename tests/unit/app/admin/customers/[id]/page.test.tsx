import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

describe('app/admin/customers/[id]/page (dispatcher)', () => {
  it('renders V1 detail when flag is not "true"', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    vi.doMock('@/components/admin/_v1/AdminCustomersV1DetailPage', () => ({
      AdminCustomersV1DetailPage: () => <div data-testid="v1-detail">V1</div>,
    }))
    vi.doMock('@/components/admin/dashboard/AdminCustomerDetailV2', () => ({
      AdminCustomerDetailV2: () => <div data-testid="v2-detail">V2</div>,
    }))
    vi.doMock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
    vi.doMock('@/lib/prisma', () => ({ prisma: { customer: { findUnique: vi.fn() } } }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/customers/[id]/page')
    render(await mod.default({ params: Promise.resolve({ id: 'c1' }) }))
    expect(screen.getByTestId('v1-detail')).toBeInTheDocument()
  })

  it('renders V2 detail when flag is "true"', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/components/admin/_v1/AdminCustomersV1DetailPage', () => ({
      AdminCustomersV1DetailPage: () => <div data-testid="v1-detail">V1</div>,
    }))
    vi.doMock('@/components/admin/dashboard/AdminCustomerDetailV2', () => ({
      AdminCustomerDetailV2: () => <div data-testid="v2-detail">V2</div>,
    }))
    vi.doMock('@/lib/auth/session', () => ({
      getSession: vi.fn().mockResolvedValue({ userId: 'u1', isAdmin: true }),
    }))
    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        customer: { findUnique: vi.fn().mockResolvedValue({ adminRole: 'ADMIN' }) },
      },
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/customers/[id]/page')
    render(await mod.default({ params: Promise.resolve({ id: 'c1' }) }))
    expect(screen.getByTestId('v2-detail')).toBeInTheDocument()
  })
})
