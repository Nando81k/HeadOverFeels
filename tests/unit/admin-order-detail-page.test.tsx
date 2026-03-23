/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminOrderDetailPage from '@/app/admin/orders/[id]/page'

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'order-1' }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

vi.mock('@/components/orders/TrackingMap', () => ({
  TrackingMap: () => <div data-testid="tracking-map" />,
}))

vi.mock('@/components/admin/ShippingLabel', () => ({
  __esModule: true,
  default: () => <div data-testid="shipping-label" />,
}))

vi.mock('@/lib/toast', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('Admin order detail fulfillment flow', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === '/api/orders/order-1' && (!init || !init.method)) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'order-1',
              orderNumber: 'HOF-1001',
              status: 'PENDING',
              paymentStatus: 'PAID',
              subtotal: 100,
              shipping: 0,
              tax: 10,
              total: 110,
              createdAt: '2026-03-20T12:00:00.000Z',
              updatedAt: '2026-03-20T12:00:00.000Z',
              trackingNumber: null,
              carrier: null,
              estimatedDelivery: null,
              shippingMethod: null,
              internalNotes: null,
              items: [
                {
                  id: 'item-1',
                  quantity: 1,
                  price: 100,
                  productVariant: { id: 'variant-1', sku: 'SKU-1', size: 'M', color: 'Navy' },
                  product: { id: 'prod-1', name: 'Navy Hoodie', slug: 'navy-hoodie', images: ['/hoodie.jpg'] },
                },
              ],
              customer: { email: 'alice@example.com' },
              shippingAddress: {
                firstName: 'Alice',
                lastName: 'Mills',
                address1: '123 Main St',
                city: 'NYC',
                state: 'NY',
                zipCode: '10001',
                country: 'US',
              },
              billingAddress: {
                firstName: 'Alice',
                lastName: 'Mills',
                address1: '123 Main St',
                city: 'NYC',
                state: 'NY',
                zipCode: '10001',
                country: 'US',
              },
            },
          }),
        } as Response
      }

      if (url === '/api/orders/order-1/tracking/live') {
        return {
          ok: true,
          json: async () => ({ hasTracking: false }),
        } as Response
      }

      if (url === '/api/orders/order-1/tracking' && init?.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({ data: { id: 'order-1' } }),
        } as Response
      }

      if (url === '/api/orders/order-1' && init?.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'order-1',
              orderNumber: 'HOF-1001',
              status: 'PROCESSING',
            },
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response
    })
  })

  it('submits unified fulfillment form and sends tracking + order updates', async () => {
    render(<AdminOrderDetailPage />)

    await screen.findByText('Fulfillment')

    fireEvent.change(screen.getByPlaceholderText('1Z999...'), {
      target: { value: '1Z999AA10123456784' },
    })

    fireEvent.change(screen.getByPlaceholderText('USPS Priority Mail'), {
      target: { value: 'USPS Ground' },
    })

    const statusSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(statusSelect, { target: { value: 'PROCESSING' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save Fulfillment' }))

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([url, init]) => ({
        url: String(url),
        method: init?.method || 'GET',
      }))
      expect(urls.some((call) => call.url === '/api/orders/order-1/tracking' && call.method === 'PATCH')).toBe(true)
      expect(urls.some((call) => call.url === '/api/orders/order-1' && call.method === 'PATCH')).toBe(true)
    })
  })
})
