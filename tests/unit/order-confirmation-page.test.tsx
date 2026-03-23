/* eslint-disable @next/next/no-img-element */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReactNode } from 'react'
import ConfirmationPage from '@/app/order/confirmation/page'

const {
  pushMock,
  refreshUserMock,
  navState,
  authState,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshUserMock: vi.fn(async () => undefined),
  navState: {
    search: 'success=true&orderId=ord-1',
  },
  authState: {
    user: {
      id: 'user-1',
      currentPoints: 1325,
      loyaltyTier: {
        name: 'Heart',
      },
    } as { id: string; currentPoints: number; loyaltyTier?: { name: string } } | null,
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
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

vi.mock('next/image', () => ({
  default: (props: {
    src: string | { src: string }
    alt: string
    fill?: boolean
    [key: string]: unknown
  }) => {
    const { src, alt, ...rest } = props
    delete (rest as { fill?: boolean }).fill
    return <img src={typeof src === 'string' ? src : src.src} alt={alt} {...rest} />
  },
}))

vi.mock('@/components/layout/Navigation', () => ({
  Navigation: () => <nav data-testid="navigation" />,
}))

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({
    user: authState.user,
    refreshUser: refreshUserMock,
  }),
}))

type MockOrder = {
  id: string
  orderNumber: string
  customerEmail: string
  couponCode?: string | null
  total: number
  subtotal: number
  shipping: number
  tax: number
  discount?: number | null
  status: string
  createdAt: string
  trackingNumber?: string | null
  carrier?: string | null
  trackingUrl?: string | null
  estimatedDelivery?: string | null
  pointsEarned?: number
  shippingAddress: {
    firstName: string
    lastName: string
    address1: string
    address2: string | null
    city: string
    state: string
    postalCode: string
  }
  items: Array<{
    id: string
    productName: string
    productImage: string | null
    quantity: number
    price: number
    variantDetails: string | null
    product?: {
      id: string
      name: string
      slug: string
      images: string | string[]
    } | null
    productVariant?: {
      id: string
      size: string | null
      color: string | null
    } | null
  }>
}

function createOrder(overrides: Partial<MockOrder> = {}): MockOrder {
  return {
    id: 'ord-1',
    orderNumber: 'HOF-12345',
    customerEmail: 'buyer@example.com',
    couponCode: 'SAVE15',
    total: 118.42,
    subtotal: 120,
    shipping: 0,
    tax: 8.42,
    discount: 10,
    status: 'SHIPPED',
    createdAt: '2026-03-20T12:00:00.000Z',
    trackingNumber: 'TRACK123',
    carrier: 'UPS',
    trackingUrl: 'https://carrier.example/track',
    estimatedDelivery: '2026-03-28T00:00:00.000Z',
    pointsEarned: 42,
    shippingAddress: {
      firstName: 'Ari',
      lastName: 'Lane',
      address1: '123 Main St',
      address2: null,
      city: 'Miami',
      state: 'FL',
      postalCode: '33101',
    },
    items: [
      {
        id: 'item-1',
        productName: 'Calm Hoodie',
        productImage: '/hoodie.jpg',
        quantity: 1,
        price: 89,
        variantDetails: JSON.stringify({ size: 'M', color: 'Cream' }),
        product: {
          id: 'prod-1',
          name: 'Calm Hoodie',
          slug: 'calm-hoodie',
          images: JSON.stringify(['/hoodie.jpg']),
        },
        productVariant: {
          id: 'var-1',
          size: 'M',
          color: 'Cream',
        },
      },
      {
        id: 'item-2',
        productName: 'Focus Tee',
        productImage: '/tee.jpg',
        quantity: 2,
        price: 14.71,
        variantDetails: JSON.stringify({ size: 'L', color: 'Black' }),
        product: {
          id: 'prod-2',
          name: 'Focus Tee',
          slug: '',
          images: JSON.stringify(['/tee.jpg']),
        },
        productVariant: {
          id: 'var-2',
          size: 'L',
          color: 'Black',
        },
      },
    ],
    ...overrides,
  }
}

function setupFetch(order: MockOrder) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url.includes(`/api/orders/${order.id}/confirm-payment`)) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          pointsEarned: order.pointsEarned || 0,
        }),
      } as Response
    }

    if (url.endsWith(`/api/orders/${order.id}`)) {
      return {
        ok: true,
        json: async () => ({
          data: order,
        }),
      } as Response
    }

    if (url.includes(`/api/orders/${order.id}/send-confirmation`)) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          message: 'sent',
        }),
      } as Response
    }

    return {
      ok: true,
      json: async () => ({
        ok: true,
      }),
    } as Response
  })

  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

describe('Order confirmation page', () => {
  beforeEach(() => {
    pushMock.mockReset()
    refreshUserMock.mockReset()
    refreshUserMock.mockResolvedValue(undefined)
    navState.search = 'success=true&orderId=ord-1'
    authState.user = {
      id: 'user-1',
      currentPoints: 1325,
      loyaltyTier: {
        name: 'Heart',
      },
    }
    localStorage.clear()
  })

  it('renders compact summary and operations cards', async () => {
    setupFetch(createOrder())

    render(<ConfirmationPage />)

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-summary-card')).toBeTruthy()
    })

    expect(screen.getByText('HOF-12345')).toBeTruthy()
    expect(screen.getByTestId('delivery-card')).toBeTruthy()
    expect(screen.getByTestId('financial-card')).toBeTruthy()
    expect(screen.getByTestId('shipping-card')).toBeTruthy()
    expect(screen.getByTestId('order-meta-card')).toBeTruthy()
  })

  it('switches primary CTA between track order and view orders', async () => {
    setupFetch(createOrder({ trackingNumber: null, trackingUrl: null }))

    render(<ConfirmationPage />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /view orders/i })).toBeTruthy()
    })

    const primaryCta = screen.getByRole('link', { name: /view orders/i })
    expect(primaryCta.getAttribute('href')).toBe('/orders')
  })

  it('uses manual resend confirmation action and does not auto-call it', async () => {
    const order = createOrder()
    const fetchMock = setupFetch(order)

    render(<ConfirmationPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resend confirmation email/i })).toBeTruthy()
    })

    const sendCallsBeforeClick = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes(`/api/orders/${order.id}/send-confirmation`)
    )
    expect(sendCallsBeforeClick).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: /resend confirmation email/i }))

    await waitFor(() => {
      expect(screen.getByText('Confirmation email sent. Check your inbox.')).toBeTruthy()
    })

    const sendCallsAfterClick = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes(`/api/orders/${order.id}/send-confirmation`)
    )
    expect(sendCallsAfterClick).toHaveLength(1)
    expect(sendCallsAfterClick[0][1]).toMatchObject({ method: 'POST' })
  })

  it('builds review links from product slug and degrades when slug is missing', async () => {
    setupFetch(createOrder())

    render(<ConfirmationPage />)

    await waitFor(() => {
      expect(screen.getByTestId('order-items-card')).toBeTruthy()
    })

    const reviewLink = screen.getByRole('link', { name: /write review/i })
    expect(reviewLink.getAttribute('href')).toBe('/products/calm-hoodie?writeReview=true&orderId=ord-1')
    expect(screen.getByText('Review unavailable')).toBeTruthy()
  })

  it('renders guest loyalty prompt when user is not signed in', async () => {
    authState.user = null
    setupFetch(createOrder({ pointsEarned: 0 }))

    render(<ConfirmationPage />)

    await waitFor(() => {
      expect(screen.getByTestId('guest-loyalty-card')).toBeTruthy()
    })

    expect(screen.queryByTestId('signed-in-loyalty-card')).toBeNull()
    expect(screen.getByRole('link', { name: /create account/i })).toBeTruthy()
  })
})
