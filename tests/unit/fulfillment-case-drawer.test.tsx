import { fireEvent, render, screen } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FulfillmentCaseDrawer } from '@/components/admin/fulfillment/FulfillmentCaseDrawer'
import type { FulfillmentDrawerTab } from '@/lib/fulfillment/console'

function buildProps(overrides: Partial<React.ComponentProps<typeof FulfillmentCaseDrawer>> = {}) {
  const onChangeTab = vi.fn()
  const onRequestClose = vi.fn()

  const props: React.ComponentProps<typeof FulfillmentCaseDrawer> = {
    isOpen: true,
    loading: false,
    activeRecordHeader: {
      primaryLabel: 'HOF-1001 • Alex',
      secondaryLabel: 'Fulfill',
    },
    activeQueueRow: {
      ageHours: 4,
      slaRisk: 'WATCH',
      nextAction: 'BUY_LABEL',
    },
    activeTab: 'summary',
    onChangeTab,
    tabAvailability: {
      summary: true,
      fulfillment: true,
      ticket: true,
      customer: true,
    },
    onRequestClose,
    fulfillmentReadiness: {
      hasOrder: true,
      primaryAction: 'BUY_LABEL',
      steps: [
        { id: 'validate_address', label: 'Validate Address', ready: false, reason: 'Shipping address is incomplete.' },
        { id: 'buy_label', label: 'Buy Label', ready: false, reason: 'Address must be valid before label purchase.' },
        { id: 'print_label', label: 'Print Label', ready: false, reason: 'Buy label first to print.' },
        { id: 'mark_shipped', label: 'Mark Shipped', ready: false, reason: 'Tracking is required.' },
        { id: 'notify_customer', label: 'Notify Customer', ready: false, reason: 'Tracking is required.' },
      ],
    },
    context: {
      order: {
        id: 'order-1',
        orderNumber: 'HOF-1001',
        status: 'PROCESSING',
        paymentStatus: 'PAID',
        subtotal: 100,
        discount: 10,
        shipping: 5,
        tax: 8,
        total: 103,
        couponCode: null,
        paymentMethod: 'CARD',
        shippingMethod: 'GROUND',
        trackingNumber: null,
        trackingUrl: null,
        carrier: null,
        notes: null,
        internalNotes: null,
        estimatedDelivery: null,
        updatedAt: new Date().toISOString(),
        shippedAt: null,
        deliveredAt: null,
        createdAt: new Date().toISOString(),
        shippingAddress: null,
        billingAddress: null,
        items: [
          {
            id: 'item-1',
            quantity: 1,
            price: 50,
            productName: 'Tee',
            productImage: null,
            variantDetails: 'L / Black',
            product: null,
            productVariant: null,
          },
        ],
      },
      selectedTicket: null,
      relatedTickets: [],
      customer: {
        id: 'customer-1',
        name: 'Alex',
        email: 'alex@example.com',
        phone: null,
        birthday: null,
        newsletter: true,
        smsOptIn: false,
        totalSpent: 103,
        totalOrders: 1,
        currentPoints: 100,
        lifetimePoints: 150,
        annualPointsEarned: 100,
        loyaltyTier: {
          id: 'tier-1',
          name: 'Mind',
          pointMultiplier: 1,
        },
        notes: [],
        pointsTransactions: [],
      },
      recentOrders: [],
      recentTickets: [],
      loyaltyTiers: [
        {
          id: 'tier-1',
          name: 'Mind',
          pointMultiplier: 1,
          sortOrder: 1,
        },
      ],
    },
    selectedTicket: null,
    orderDraft: {
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      trackingNumber: '',
      carrier: '',
      trackingUrl: '',
      internalNotes: '',
    },
    setOrderDraft: vi.fn(),
    ticketStatusDraft: 'OPEN',
    setTicketStatusDraft: vi.fn(),
    externalReference: '',
    setExternalReference: vi.fn(),
    ticketReplyMessage: '',
    setTicketReplyMessage: vi.fn(),
    ticketReplyInternal: true,
    setTicketReplyInternal: vi.fn(),
    ticketNote: '',
    setTicketNote: vi.fn(),
    customerDraft: {
      name: 'Alex',
      phone: '',
      birthday: '',
      newsletter: true,
      smsOptIn: false,
    },
    setCustomerDraft: vi.fn(),
    customerPointsDelta: '',
    setCustomerPointsDelta: vi.fn(),
    customerPointsReason: '',
    setCustomerPointsReason: vi.fn(),
    customerTierDraft: '',
    setCustomerTierDraft: vi.fn(),
    customerNoteDraft: '',
    setCustomerNoteDraft: vi.fn(),
    customerNoteImportant: false,
    setCustomerNoteImportant: vi.fn(),
    actionLoading: false,
    lastSingleLabelUrl: null,
    formatCurrency: (value) => `$${(value || 0).toFixed(2)}`,
    formatDate: () => 'Today',
    onSaveOrder: vi.fn(),
    onPurchaseSingleLabel: vi.fn(),
    onMarkShipped: vi.fn(),
    onNotifyTrackingUpdate: vi.fn(),
    onRunPrimaryAction: vi.fn(),
    onUpdateTicketStatus: vi.fn(),
    onSendTicketReply: vi.fn(),
    onApplyTicketDecision: vi.fn(),
    onSaveCustomerProfile: vi.fn(),
    onAdjustPoints: vi.fn(),
    onChangeTier: vi.fn(),
    onAddNote: vi.fn(),
    onDeleteNote: vi.fn(),
    ...overrides,
  }

  return { props, onChangeTab, onRequestClose }
}

describe('FulfillmentCaseDrawer', () => {
  it('renders and allows tab switching', () => {
    const { props, onChangeTab } = buildProps()

    render(<FulfillmentCaseDrawer {...props} />)

    expect(screen.queryByRole('button', { name: 'Activity' })).toBeNull()
    fireEvent.click(screen.getByText('Fulfillment'))
    expect(onChangeTab).toHaveBeenCalledWith('fulfillment' satisfies FulfillmentDrawerTab)
  })

  it('respects disabled tab availability', () => {
    const { props, onChangeTab } = buildProps({
      tabAvailability: {
        summary: true,
        fulfillment: true,
        ticket: false,
        customer: true,
      },
    })

    render(<FulfillmentCaseDrawer {...props} />)

    const ticketTab = screen.getByRole('button', { name: 'Ticket' })
    expect(ticketTab.getAttribute('disabled')).not.toBeNull()
    fireEvent.click(ticketTab)
    expect(onChangeTab).not.toHaveBeenCalledWith('ticket')
  })

  it('shows full-detail and legacy handoff links in summary tab', () => {
    const { props } = buildProps()

    render(<FulfillmentCaseDrawer {...props} />)

    expect(screen.getByRole('link', { name: 'Open Full Details' }).getAttribute('href')).toContain(
      '/admin/fulfillment/details'
    )
    expect(screen.getByText('More Actions')).toBeTruthy()
  })

  it('calls close callback from drawer close button', () => {
    const { props, onRequestClose } = buildProps()

    render(<FulfillmentCaseDrawer {...props} />)
    fireEvent.click(screen.getByLabelText('Close drawer'))
    expect(onRequestClose).toHaveBeenCalledTimes(1)
  })

  it('runs guided fulfillment step action buttons', () => {
    const onPurchaseSingleLabel = vi.fn()
    const onMarkShipped = vi.fn()
    const { props } = buildProps({
      activeTab: 'fulfillment',
      activeQueueRow: {
        ageHours: 4,
        slaRisk: 'WATCH',
        nextAction: 'OPEN_CASE',
      },
      fulfillmentReadiness: {
        hasOrder: true,
        primaryAction: 'BUY_LABEL',
        steps: [
          { id: 'validate_address', label: 'Validate Address', ready: true },
          { id: 'buy_label', label: 'Buy Label', ready: true },
          { id: 'print_label', label: 'Print Label', ready: false, reason: 'Buy label first to print.' },
          { id: 'mark_shipped', label: 'Mark Shipped', ready: true },
          { id: 'notify_customer', label: 'Notify Customer', ready: true },
        ],
      },
      onPurchaseSingleLabel,
      onMarkShipped,
    })

    render(<FulfillmentCaseDrawer {...props} />)

    fireEvent.click(screen.getByTestId('guided-step-action-buy_label'))
    fireEvent.click(screen.getByTestId('guided-step-action-mark_shipped'))

    expect(onPurchaseSingleLabel).toHaveBeenCalledTimes(1)
    expect(onMarkShipped).toHaveBeenCalledTimes(1)
  })
})
