import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/components/admin/dashboard/AdminOrderDetailV2', () => ({
  AdminOrderDetailV2: () => <div data-testid="v2">V2</div>,
}))
vi.mock('@/components/admin/_v1/AdminOrderDetailV1', () => ({
  AdminOrderDetailV1: () => <div data-testid="v1">V1</div>,
}))

beforeEach(() => {
  vi.resetModules()
})

describe('admin/fulfillment/[orderId] dispatcher', () => {
  it('renders V1 when flag is false', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/fulfillment/[orderId]/page')
    render(await mod.default({ params: Promise.resolve({ orderId: 'o1' }) }))
    expect(screen.getByTestId('v1')).toBeInTheDocument()
  })

  it('renders V2 when flag is true', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/fulfillment/[orderId]/page')
    render(await mod.default({ params: Promise.resolve({ orderId: 'o1' }) }))
    expect(screen.getByTestId('v2')).toBeInTheDocument()
  })

  it('passes orderId through to V2', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const v2Spy = vi.fn(() => <div data-testid="v2-with-id">id received</div>)
    vi.doMock('@/components/admin/dashboard/AdminOrderDetailV2', () => ({
      AdminOrderDetailV2: v2Spy,
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/fulfillment/[orderId]/page')
    render(await mod.default({ params: Promise.resolve({ orderId: 'order-42' }) }))
    expect(screen.getByTestId('v2-with-id')).toBeInTheDocument()
    expect(v2Spy).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-42' }),
      undefined,
    )
  })

  it('passes orderId through to V1', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const v1Spy = vi.fn(() => <div data-testid="v1-with-id">id received</div>)
    vi.doMock('@/components/admin/_v1/AdminOrderDetailV1', () => ({
      AdminOrderDetailV1: v1Spy,
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/fulfillment/[orderId]/page')
    render(await mod.default({ params: Promise.resolve({ orderId: 'order-99' }) }))
    expect(screen.getByTestId('v1-with-id')).toBeInTheDocument()
    expect(v1Spy).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-99' }),
      undefined,
    )
  })
})
