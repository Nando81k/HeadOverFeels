import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import FulfillmentDetailsPage from '@/app/admin/fulfillment/details/page'

const { navState } = vi.hoisted(() => ({
  navState: {
    search: 'orderId=order-1&ticketId=ticket-1&tab=ticket',
  },
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navState.search),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: ReactNode
    [key: string]: unknown
  }) => <a href={href} {...props}>{children}</a>,
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({
    title,
    subtitle,
    headerActions,
    children,
  }: {
    title: string
    subtitle?: string
    headerActions?: ReactNode
    children: ReactNode
  }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      <div>{headerActions}</div>
      <div>{children}</div>
    </div>
  ),
}))

function buildContextPayload() {
  return {
    order: {
      id: 'order-1',
      orderNumber: 'HOF-1001',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      subtotal: 120,
      discount: 10,
      shipping: 5,
      tax: 7,
      total: 122,
      couponCode: 'SAVE10',
      paymentMethod: 'card',
      shippingMethod: 'standard',
      trackingNumber: 'TRK123',
      trackingUrl: 'https://carrier.example/TRK123',
      carrier: 'UPS',
      notes: 'Customer requested gift wrap',
      internalNotes: 'Pack with card insert',
      estimatedDelivery: '2026-03-27T12:00:00.000Z',
      deliveredAt: null,
      shippedAt: '2026-03-23T10:00:00.000Z',
      createdAt: '2026-03-22T09:00:00.000Z',
      updatedAt: '2026-03-23T11:00:00.000Z',
      customerId: 'customer-1',
      shippingAddress: {
        firstName: 'Alex',
        lastName: 'Mills',
        address1: '123 Main St',
        address2: null,
        city: 'Miami',
        state: 'FL',
        postalCode: '33101',
        country: 'US',
      },
      billingAddress: {
        firstName: 'Alex',
        lastName: 'Mills',
        address1: '123 Main St',
        address2: null,
        city: 'Miami',
        state: 'FL',
        postalCode: '33101',
        country: 'US',
      },
      items: [
        {
          id: 'item-1',
          quantity: 2,
          price: 45,
          productName: 'Calm Tee',
          productImage: '/tee.jpg',
          variantDetails: 'L / Navy',
          product: {
            id: 'product-1',
            name: 'Calm Tee',
            slug: 'calm-tee',
            images: ['/tee.jpg'],
          },
          productVariant: {
            id: 'variant-1',
            sku: 'SKU-1',
            size: 'L',
            color: 'Navy',
          },
        },
      ],
    },
    selectedTicket: {
      id: 'ticket-1',
      ticketNumber: 'TKT-1001',
      type: 'SHIPPING_ISSUE',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      subject: 'Where is my package?',
      returnRequested: false,
      returnApproved: null,
      returnLabel: null,
      refundAmount: null,
      refundReason: null,
      resolution: null,
      orderId: 'order-1',
      orderNumber: 'HOF-1001',
      createdAt: '2026-03-23T08:00:00.000Z',
      updatedAt: '2026-03-23T09:00:00.000Z',
      assignedTo: {
        id: 'admin-1',
        name: 'Admin User',
        email: 'admin@headoverfeels.com',
      },
      messages: [
        {
          id: 'message-1',
          message: 'We are checking with the carrier.',
          senderType: 'admin',
          senderName: 'Admin User',
          isInternal: false,
          createdAt: '2026-03-23T09:30:00.000Z',
        },
      ],
    },
    relatedTickets: [
      {
        id: 'ticket-1',
        ticketNumber: 'TKT-1001',
        type: 'SHIPPING_ISSUE',
        status: 'IN_PROGRESS',
        subject: 'Where is my package?',
        returnRequested: false,
        returnApproved: null,
        returnLabel: null,
        refundAmount: null,
        createdAt: '2026-03-23T08:00:00.000Z',
        _count: {
          messages: 1,
        },
      },
    ],
    customer: {
      id: 'customer-1',
      name: 'Alex Mills',
      email: 'alex@example.com',
      phone: '305-555-1111',
      birthday: null,
      newsletter: true,
      smsOptIn: false,
      totalSpent: 990,
      totalOrders: 8,
      currentPoints: 1430,
      lifetimePoints: 2600,
      annualPointsEarned: 1600,
      loyaltyTier: {
        id: 'tier-friend',
        name: 'Friend',
        pointMultiplier: 1.25,
      },
      notes: [],
      pointsTransactions: [
        {
          id: 'points-1',
          points: 120,
          type: 'EARNED_PURCHASE',
          description: 'Order HOF-1001',
          createdAt: '2026-03-23T09:00:00.000Z',
        },
      ],
      _count: {
        orders: 8,
        supportTickets: 2,
        notes: 0,
      },
    },
    recentOrders: [
      {
        id: 'order-1',
        orderNumber: 'HOF-1001',
        status: 'PROCESSING',
        paymentStatus: 'PAID',
        total: 122,
        createdAt: '2026-03-22T09:00:00.000Z',
      },
    ],
    recentTickets: [
      {
        id: 'ticket-1',
        ticketNumber: 'TKT-1001',
        type: 'SHIPPING_ISSUE',
        status: 'IN_PROGRESS',
        subject: 'Where is my package?',
        createdAt: '2026-03-23T08:00:00.000Z',
      },
    ],
    loyaltyTiers: [
      {
        id: 'tier-mind',
        name: 'Mind',
        pointMultiplier: 1,
        sortOrder: 1,
      },
      {
        id: 'tier-friend',
        name: 'Friend',
        pointMultiplier: 1.25,
        sortOrder: 2,
      },
    ],
  }
}

describe('Fulfillment details page', () => {
  beforeEach(() => {
    navState.search = 'orderId=order-1&ticketId=ticket-1&tab=ticket'

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/api/admin/fulfillment/context')) {
        return {
          ok: true,
          json: async () => buildContextPayload(),
        } as Response
      }

      if (url.includes('/api/orders/order-1/tracking/live')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              trackingNumber: 'TRK123',
              carrier: 'UPS',
              statusDescription: 'In transit',
              transitProgress: 55,
              estimatedDelivery: '2026-03-27T12:00:00.000Z',
              events: [{ timestamp: '2026-03-23T10:00:00.000Z', status: 'In transit', location: 'Miami, FL' }],
            },
          }),
        } as Response
      }

      if (url.includes('/api/admin/customers/customer-1')) {
        return {
          ok: true,
          json: async () => ({
            customer: {
              totalSpent: 990,
              totalOrders: 8,
              avgOrderValue: 123.75,
              lastOrderDate: '2026-03-22T09:00:00.000Z',
              currentPoints: 1430,
              lifetimePoints: 2600,
              annualPointsEarned: 1600,
              expiringPoints: 150,
              expiringDate: '2026-12-31T00:00:00.000Z',
              currentTier: {
                id: 'tier-friend',
                name: 'Friend',
                pointMultiplier: 1.25,
              },
              nextTier: {
                id: 'tier-bestie',
                name: 'Bestie',
                pointMultiplier: 1.5,
                minAnnualPoints: 3000,
              },
            },
            orders: [],
            pointsTransactions: [],
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response
    }) as unknown as typeof fetch
  })

  it('loads from query params and renders back/deep links', async () => {
    render(<FulfillmentDetailsPage />)

    await waitFor(() => {
      expect(screen.getByText('Fulfillment Details')).toBeTruthy()
    })

    await waitFor(() => {
      expect(screen.getByText('Where is my package?')).toBeTruthy()
    })

    const backLink = screen.getByRole('link', { name: 'Back To Queue' })
    expect(backLink.getAttribute('href')).toBe('/admin/fulfillment?orderId=order-1&ticketId=ticket-1')

    expect(screen.getByRole('link', { name: 'Legacy Order' }).getAttribute('href')).toBe('/admin/orders/order-1')
    expect(screen.getByRole('link', { name: 'Legacy Ticket' }).getAttribute('href')).toBe('/admin/support/tickets/ticket-1')
    expect(screen.getByRole('link', { name: 'Legacy Customer' }).getAttribute('href')).toBe('/admin/customers/customer-1')
  })

  it('switches tabs and renders deeper section content', async () => {
    navState.search = 'orderId=order-1&ticketId=ticket-1&tab=order'

    render(<FulfillmentDetailsPage />)

    await waitFor(() => {
      expect(screen.getByText('Order Summary')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Customer' }))

    await waitFor(() => {
      expect(screen.getByText('Expanded Loyalty Snapshot')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Activity' }))

    await waitFor(() => {
      expect(screen.getByText('Recent Orders')).toBeTruthy()
    })
  })
})
