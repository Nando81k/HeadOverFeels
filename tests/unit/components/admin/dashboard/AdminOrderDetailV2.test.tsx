import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/fulfillment', () => ({
  loadOrderDetail: vi.fn(async (id: string) =>
    id === 'missing'
      ? null
      : {
          id,
          orderNumber: 'HOF-1',
          status: 'PROCESSING',
          paymentStatus: 'PAID',
          total: 100,
          subtotal: 90,
          tax: 5,
          shipping: 5,
          customerId: 'c1',
          customerName: 'Ada',
          customerEmail: 'a@e.com',
          customerPhone: null,
          trackingNumber: null,
          trackingUrl: null,
          carrier: null,
          shippedAt: null,
          deliveredAt: null,
          estimatedDelivery: null,
          notes: null,
          internalNotes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          shippingAddress: null,
          billingAddress: null,
          items: [],
          returns: [],
          refunds: [],
        },
  ),
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockWidget = (testid: string) => {
  const Stub = () => <div data-testid={testid} />
  Stub.displayName = `Stub(${testid})`
  return Stub
}
vi.mock('@/components/admin/fulfillment/detail/OrderHeader', () => ({
  OrderHeader: mockWidget('w-header'),
}))
vi.mock('@/components/admin/fulfillment/detail/OrderLineItems', () => ({
  OrderLineItems: mockWidget('w-items'),
}))
vi.mock('@/components/admin/fulfillment/detail/OrderShippingPanel', () => ({
  OrderShippingPanel: mockWidget('w-shipping'),
}))
vi.mock('@/components/admin/fulfillment/detail/OrderPaymentPanel', () => ({
  OrderPaymentPanel: mockWidget('w-payment'),
}))
vi.mock('@/components/admin/fulfillment/detail/OrderTimeline', () => ({
  OrderTimeline: mockWidget('w-timeline'),
}))
vi.mock('@/components/admin/fulfillment/detail/OrderNotesPanel', () => ({
  OrderNotesPanel: mockWidget('w-notes'),
}))
vi.mock('@/components/admin/fulfillment/detail/OrderReturnsPanel', () => ({
  OrderReturnsPanel: mockWidget('w-returns'),
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

describe('AdminOrderDetailV2', () => {
  it('composes 7 widgets when order exists', async () => {
    const { AdminOrderDetailV2 } = await import(
      '@/components/admin/dashboard/AdminOrderDetailV2'
    )
    render(await AdminOrderDetailV2({ orderId: 'o1' }))
    expect(screen.getByTestId('w-header')).toBeInTheDocument()
    expect(screen.getByTestId('w-items')).toBeInTheDocument()
    expect(screen.getByTestId('w-shipping')).toBeInTheDocument()
    expect(screen.getByTestId('w-payment')).toBeInTheDocument()
    expect(screen.getByTestId('w-timeline')).toBeInTheDocument()
    expect(screen.getByTestId('w-notes')).toBeInTheDocument()
    expect(screen.getByTestId('w-returns')).toBeInTheDocument()
  })

  it('throws NEXT_NOT_FOUND when order missing', async () => {
    const { AdminOrderDetailV2 } = await import(
      '@/components/admin/dashboard/AdminOrderDetailV2'
    )
    await expect(AdminOrderDetailV2({ orderId: 'missing' })).rejects.toThrow(/NEXT_NOT_FOUND/)
  })
})
