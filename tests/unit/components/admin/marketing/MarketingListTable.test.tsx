// tests/unit/components/admin/marketing/MarketingListTable.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MarketingListTable } from '@/components/admin/marketing/MarketingListTable'
import type {
  PromotionRow, PopupRow, SubscriberRow, CampaignRow, AbandonedCartRow,
} from '@/lib/admin/marketing'

const promo: PromotionRow = {
  id: 'p1', name: 'Summer 20', code: 'SUMMER20', type: 'PERCENTAGE',
  value: 20, isActive: true, usedCount: 12, maxUsesTotal: 100,
  startDate: new Date('2026-05-01'), endDate: new Date('2026-06-01'),
  totalDiscountGiven: 1234.5, autoApply: false, stackable: false,
  createdAt: new Date('2026-05-01'),
}

const popup: PopupRow = {
  id: 'pp1', name: 'Welcome modal', template: 'MODAL', position: 'CENTER',
  triggerType: 'DELAY', isActive: true, priority: 1,
  impressions7d: 300, conversions7d: 15,
  startDate: null, endDate: null, createdAt: new Date('2026-05-01'),
}

const sub: SubscriberRow = {
  id: 's1', email: 'ada@e.com', source: 'popup', sourceDetails: null,
  isActive: true, isVerified: true, createdAt: new Date('2026-05-01'),
  unsubscribedAt: null, utmSource: 'google',
}

const campaign: CampaignRow = {
  id: 'c1', name: 'May newsletter', subject: 'Hello May',
  status: 'SENT', audienceCount: 1000, sentCount: 990, failedCount: 10,
  sentAt: new Date('2026-05-15'), createdAt: new Date('2026-05-10'),
}

const cart: AbandonedCartRow = {
  id: 'ac1', customerEmail: 'lost@e.com', customerName: 'Lost',
  totalValue: 89.99, itemCount: 2, recovered: false,
  recoveryEmailSent: false, abandonedAt: new Date('2026-05-20'),
  expiresAt: new Date('2026-06-20'), discountCode: null,
}

describe('MarketingListTable promotions variant', () => {
  it('renders promotion columns', () => {
    render(
      <MarketingListTable
        variant="promotions"
        rows={[promo]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    expect(screen.getByText('Summer 20')).toBeInTheDocument()
    expect(screen.getByText('SUMMER20')).toBeInTheDocument()
    expect(screen.getByText(/12/)).toBeInTheDocument() // usedCount
  })

  it('calls onOpenInspector when ⋯ clicked', () => {
    const onOpenInspector = vi.fn()
    render(
      <MarketingListTable
        variant="promotions"
        rows={[promo]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={onOpenInspector}
      />,
    )
    fireEvent.click(screen.getByTestId('row-actions-p1'))
    expect(onOpenInspector).toHaveBeenCalledWith('p1')
  })
})

describe('MarketingListTable popups variant', () => {
  it('renders popup columns with 7-day impressions/conversions', () => {
    render(
      <MarketingListTable
        variant="popups"
        rows={[popup]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    expect(screen.getByText('Welcome modal')).toBeInTheDocument()
    expect(screen.getByText('MODAL')).toBeInTheDocument()
    expect(screen.getByText('300')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })
})

describe('MarketingListTable subscribers variant', () => {
  it('renders subscriber columns', () => {
    render(
      <MarketingListTable
        variant="subscribers"
        rows={[sub]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    expect(screen.getByText('ada@e.com')).toBeInTheDocument()
    expect(screen.getByText('popup')).toBeInTheDocument()
  })
})

describe('MarketingListTable campaigns variant', () => {
  it('renders campaign columns including status pill', () => {
    render(
      <MarketingListTable
        variant="campaigns"
        rows={[campaign]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    expect(screen.getByText('Hello May')).toBeInTheDocument()
    expect(screen.getByText('SENT')).toBeInTheDocument()
    expect(screen.getByText(/990/)).toBeInTheDocument()
  })
})

describe('MarketingListTable carts variant', () => {
  it('renders cart columns', () => {
    render(
      <MarketingListTable
        variant="carts"
        rows={[cart]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    expect(screen.getByText('lost@e.com')).toBeInTheDocument()
    expect(screen.getByText(/\$89\.99/)).toBeInTheDocument()
  })
})

describe('MarketingListTable common behavior', () => {
  it('renders loading skeleton when loading=true', () => {
    render(
      <MarketingListTable
        variant="promotions"
        rows={[]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
        loading
      />,
    )
    expect(screen.getAllByTestId('marketing-list-skeleton-row').length).toBeGreaterThan(0)
  })

  it('renders empty state when rows is empty and not loading', () => {
    render(
      <MarketingListTable
        variant="promotions"
        rows={[]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    expect(screen.getByText(/no promotions/i)).toBeInTheDocument()
  })

  it('select-all toggles every row via onSelectAll', () => {
    const onSelectAll = vi.fn()
    render(
      <MarketingListTable
        variant="promotions"
        rows={[promo]}
        selected={new Set()}
        onSelect={vi.fn()}
        onSelectAll={onSelectAll}
        onOpenInspector={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('marketing-select-all'))
    expect(onSelectAll).toHaveBeenCalledWith(true)
  })
})
