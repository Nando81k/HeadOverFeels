// tests/unit/components/admin/marketing/MarketingListCardMobile.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MarketingListCardMobile } from '@/components/admin/marketing/MarketingListCardMobile'
import type {
  PromotionRow,
  PopupRow,
  SubscriberRow,
  CampaignRow,
  AbandonedCartRow,
} from '@/lib/admin/marketing'

// Mock SwipeableRow to expose rightActions as rendered buttons
vi.mock('@/components/ui/SwipeableRow', () => ({
  SwipeableRow: ({
    children,
    rightActions,
    className,
  }: {
    children: React.ReactNode
    rightActions?: Array<{ onClick: () => void; label: string }>
    className?: string
  }) => (
    <div data-testid="swipeable-row" className={className}>
      {rightActions?.map((action, i) => (
        <button key={i} type="button" onClick={action.onClick} data-testid="swipe-action">
          {action.label}
        </button>
      ))}
      {children}
    </div>
  ),
}))

// ── Fixture rows ───────────────────────────────────────────────────────────

const promoRow: PromotionRow = {
  id: 'pr1',
  name: 'Summer Sale',
  code: 'SUMMER20',
  type: 'PERCENTAGE',
  value: 20,
  isActive: true,
  usedCount: 12,
  maxUsesTotal: 100,
  startDate: new Date('2026-05-01'),
  endDate: new Date('2026-06-01'),
  totalDiscountGiven: 1234.5,
  autoApply: false,
  stackable: false,
  createdAt: new Date('2026-05-01'),
}

const popupRow: PopupRow = {
  id: 'pp1',
  name: 'Welcome Modal',
  template: 'MODAL',
  position: 'CENTER',
  triggerType: 'DELAY',
  isActive: false,
  priority: 1,
  startDate: null,
  endDate: null,
  createdAt: new Date('2026-05-01'),
  impressions7d: 300,
  conversions7d: 15,
}

const subscriberRow: SubscriberRow = {
  id: 'sub1',
  email: 'ada@example.com',
  source: 'popup',
  sourceDetails: null,
  isActive: true,
  isVerified: true,
  createdAt: new Date('2026-05-01'),
  unsubscribedAt: null,
  utmSource: 'google',
}

const campaignRow: CampaignRow = {
  id: 'cam1',
  name: 'May Newsletter',
  subject: 'Hello May',
  status: 'SENT',
  audienceCount: 1000,
  sentCount: 990,
  failedCount: 10,
  sentAt: new Date('2026-05-15'),
  createdAt: new Date('2026-05-10'),
}

const cartRow: AbandonedCartRow = {
  id: 'cart1',
  customerEmail: 'lost@example.com',
  customerName: 'Lost User',
  itemCount: 3,
  totalValue: 89.99,
  recovered: false,
  recoveryEmailSent: false,
  abandonedAt: new Date('2026-05-20'),
  expiresAt: new Date('2026-06-20'),
  discountCode: 'RECOVER10',
}

const commonProps = {
  selected: false,
  onLongPress: vi.fn<(id: string) => void>(),
  onEdit: vi.fn<(id: string) => void>(),
  onQuickAction: vi.fn<(action: string, id: string) => void>(),
}

// ── Promotions variant ─────────────────────────────────────────────────────

describe('MarketingListCardMobile — variant: promotions', () => {
  it('renders promo name, code, type, and value', () => {
    render(
      <MarketingListCardMobile
        variant="promotions"
        row={promoRow}
        {...commonProps}
      />,
    )
    expect(screen.getByText('Summer Sale')).toBeInTheDocument()
    expect(screen.getByText('SUMMER20')).toBeInTheDocument()
    expect(screen.getByText(/PERCENTAGE/)).toBeInTheDocument()
  })

  it('fires onLongPress with promo id on contextMenu', () => {
    const onLongPress = vi.fn<(id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="promotions"
        row={promoRow}
        {...commonProps}
        onLongPress={onLongPress}
      />,
    )
    fireEvent.contextMenu(screen.getByTestId('marketing-card'))
    expect(onLongPress).toHaveBeenCalledWith('pr1')
  })

  it('fires onEdit with promo id on Edit button click', () => {
    const onEdit = vi.fn<(id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="promotions"
        row={promoRow}
        {...commonProps}
        onEdit={onEdit}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledWith('pr1')
  })

  it('swipe-left "Activate" calls onQuickAction("activate", id)', () => {
    const onQuickAction = vi.fn<(action: string, id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="promotions"
        row={promoRow}
        {...commonProps}
        onQuickAction={onQuickAction}
      />,
    )
    fireEvent.click(screen.getByTestId('swipe-action'))
    expect(onQuickAction).toHaveBeenCalledWith('activate', 'pr1')
  })

  it('shows selected state visually', () => {
    render(
      <MarketingListCardMobile
        variant="promotions"
        row={promoRow}
        {...commonProps}
        selected={true}
      />,
    )
    const card = screen.getByTestId('marketing-card')
    expect(card.className).toMatch(/ring|border-(emerald|blue|sky|indigo)/)
  })

  it('is hidden on desktop via md:hidden', () => {
    render(
      <MarketingListCardMobile
        variant="promotions"
        row={promoRow}
        {...commonProps}
      />,
    )
    const wrapper = screen.getByTestId('swipeable-row')
    expect(wrapper.className).toContain('md:hidden')
  })
})

// ── Popups variant ─────────────────────────────────────────────────────────

describe('MarketingListCardMobile — variant: popups', () => {
  it('renders popup name, template, impressions and conversions', () => {
    render(
      <MarketingListCardMobile
        variant="popups"
        row={popupRow}
        {...commonProps}
      />,
    )
    expect(screen.getByText('Welcome Modal')).toBeInTheDocument()
    expect(screen.getByText(/MODAL · DELAY/)).toBeInTheDocument()
    expect(screen.getByText(/300 impr/)).toBeInTheDocument()
    expect(screen.getByText(/15 conv/)).toBeInTheDocument()
  })

  it('swipe-left "Activate" calls onQuickAction("activate", id) for popups', () => {
    const onQuickAction = vi.fn<(action: string, id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="popups"
        row={popupRow}
        {...commonProps}
        onQuickAction={onQuickAction}
      />,
    )
    fireEvent.click(screen.getByTestId('swipe-action'))
    expect(onQuickAction).toHaveBeenCalledWith('activate', 'pp1')
  })

  it('fires onLongPress with popup id on contextMenu', () => {
    const onLongPress = vi.fn<(id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="popups"
        row={popupRow}
        {...commonProps}
        onLongPress={onLongPress}
      />,
    )
    fireEvent.contextMenu(screen.getByTestId('marketing-card'))
    expect(onLongPress).toHaveBeenCalledWith('pp1')
  })

  it('fires onEdit with popup id on Edit button click', () => {
    const onEdit = vi.fn<(id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="popups"
        row={popupRow}
        {...commonProps}
        onEdit={onEdit}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledWith('pp1')
  })
})

// ── Subscribers variant ────────────────────────────────────────────────────

describe('MarketingListCardMobile — variant: subscribers', () => {
  it('renders subscriber email, source, and status', () => {
    render(
      <MarketingListCardMobile
        variant="subscribers"
        row={subscriberRow}
        {...commonProps}
      />,
    )
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText(/popup/i)).toBeInTheDocument()
  })

  it('swipe-left "Unsubscribe" calls onQuickAction("unsubscribe", id)', () => {
    const onQuickAction = vi.fn<(action: string, id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="subscribers"
        row={subscriberRow}
        {...commonProps}
        onQuickAction={onQuickAction}
      />,
    )
    fireEvent.click(screen.getByTestId('swipe-action'))
    expect(onQuickAction).toHaveBeenCalledWith('unsubscribe', 'sub1')
  })

  it('fires onLongPress with subscriber id on contextMenu', () => {
    const onLongPress = vi.fn<(id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="subscribers"
        row={subscriberRow}
        {...commonProps}
        onLongPress={onLongPress}
      />,
    )
    fireEvent.contextMenu(screen.getByTestId('marketing-card'))
    expect(onLongPress).toHaveBeenCalledWith('sub1')
  })

  it('fires onEdit with subscriber id on Edit button click', () => {
    const onEdit = vi.fn<(id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="subscribers"
        row={subscriberRow}
        {...commonProps}
        onEdit={onEdit}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledWith('sub1')
  })
})

// ── Campaigns variant (no swipe) ───────────────────────────────────────────

describe('MarketingListCardMobile — variant: campaigns', () => {
  it('renders campaign name, subject, and status', () => {
    render(
      <MarketingListCardMobile
        variant="campaigns"
        row={campaignRow}
        {...commonProps}
      />,
    )
    expect(screen.getByText('May Newsletter')).toBeInTheDocument()
    expect(screen.getByText('Hello May')).toBeInTheDocument()
    expect(screen.getByText('SENT')).toBeInTheDocument()
  })

  it('renders sent count and audience count', () => {
    render(
      <MarketingListCardMobile
        variant="campaigns"
        row={campaignRow}
        {...commonProps}
      />,
    )
    expect(screen.getByText(/990/)).toBeInTheDocument()
    expect(screen.getByText(/1000/)).toBeInTheDocument()
  })

  it('does NOT render a swipe action for campaigns', () => {
    render(
      <MarketingListCardMobile
        variant="campaigns"
        row={campaignRow}
        {...commonProps}
      />,
    )
    expect(screen.queryByTestId('swipe-action')).not.toBeInTheDocument()
  })

  it('fires onLongPress with campaign id on contextMenu', () => {
    const onLongPress = vi.fn<(id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="campaigns"
        row={campaignRow}
        {...commonProps}
        onLongPress={onLongPress}
      />,
    )
    fireEvent.contextMenu(screen.getByTestId('marketing-card'))
    expect(onLongPress).toHaveBeenCalledWith('cam1')
  })

  it('fires onEdit with campaign id on Edit button click', () => {
    const onEdit = vi.fn<(id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="campaigns"
        row={campaignRow}
        {...commonProps}
        onEdit={onEdit}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledWith('cam1')
  })
})

// ── Abandoned carts variant ────────────────────────────────────────────────

describe('MarketingListCardMobile — variant: carts', () => {
  it('renders customer email, item count, and total value', () => {
    render(
      <MarketingListCardMobile
        variant="carts"
        row={cartRow}
        {...commonProps}
      />,
    )
    expect(screen.getByText('lost@example.com')).toBeInTheDocument()
    expect(screen.getByText(/3 items?/i)).toBeInTheDocument()
    expect(screen.getByText(/\$89\.99/i)).toBeInTheDocument()
  })

  it('swipe-left "Send Recovery" calls onQuickAction("send-recovery", id)', () => {
    const onQuickAction = vi.fn<(action: string, id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="carts"
        row={cartRow}
        {...commonProps}
        onQuickAction={onQuickAction}
      />,
    )
    fireEvent.click(screen.getByTestId('swipe-action'))
    expect(onQuickAction).toHaveBeenCalledWith('send-recovery', 'cart1')
  })

  it('fires onLongPress with cart id on contextMenu', () => {
    const onLongPress = vi.fn<(id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="carts"
        row={cartRow}
        {...commonProps}
        onLongPress={onLongPress}
      />,
    )
    fireEvent.contextMenu(screen.getByTestId('marketing-card'))
    expect(onLongPress).toHaveBeenCalledWith('cart1')
  })

  it('fires onEdit with cart id on Edit button click', () => {
    const onEdit = vi.fn<(id: string) => void>()
    render(
      <MarketingListCardMobile
        variant="carts"
        row={cartRow}
        {...commonProps}
        onEdit={onEdit}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledWith('cart1')
  })

  it('shows recovery email sent badge when recoveryEmailSent is true', () => {
    render(
      <MarketingListCardMobile
        variant="carts"
        row={{ ...cartRow, recoveryEmailSent: true }}
        {...commonProps}
      />,
    )
    expect(screen.getByText(/sent/i)).toBeInTheDocument()
  })
})
