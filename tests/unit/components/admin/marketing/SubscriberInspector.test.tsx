// tests/unit/components/admin/marketing/SubscriberInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  unsubscribeSubscriber: vi.fn(async () => ({ ok: true })),
  deleteSubscriber: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/ui/Inspector', () => ({
  Inspector: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="inspector">{children}</div> : null,
}))

const detail = {
  id: 's1', email: 'ada@e.com', source: 'popup', sourceDetails: 'modal-A',
  isActive: true, isVerified: true,
  verifiedAt: new Date('2026-05-01'),
  unsubscribedAt: null, unsubscribeReason: null,
  utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'spring',
  createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01'),
}

beforeEach(() => { vi.clearAllMocks() })

describe('SubscriberInspector', () => {
  it('renders email + source + UTM as read-only', async () => {
    const { SubscriberInspector } = await import('@/components/admin/marketing/SubscriberInspector')
    render(<SubscriberInspector open detail={detail} isSuperAdmin={false} onClose={vi.fn()} />)
    expect(screen.getByText('ada@e.com')).toBeInTheDocument()
    expect(screen.getByText('popup')).toBeInTheDocument()
    expect(screen.getByText('google')).toBeInTheDocument()
  })

  it('Unsubscribe button calls unsubscribeSubscriber', async () => {
    const { SubscriberInspector } = await import('@/components/admin/marketing/SubscriberInspector')
    const { unsubscribeSubscriber } = await import('@/app/admin/marketing/actions')
    render(<SubscriberInspector open detail={detail} isSuperAdmin={false} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Unsubscribe'))
    await waitFor(() => {
      expect(unsubscribeSubscriber).toHaveBeenCalledWith('s1')
    })
  })

  it('Delete is disabled when isSuperAdmin=false', async () => {
    const { SubscriberInspector } = await import('@/components/admin/marketing/SubscriberInspector')
    render(<SubscriberInspector open detail={detail} isSuperAdmin={false} onClose={vi.fn()} />)
    const btn = screen.getByText('Delete') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Delete calls deleteSubscriber when isSuperAdmin=true', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    const { SubscriberInspector } = await import('@/components/admin/marketing/SubscriberInspector')
    const { deleteSubscriber } = await import('@/app/admin/marketing/actions')
    render(<SubscriberInspector open detail={detail} isSuperAdmin onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Delete'))
    await waitFor(() => {
      expect(deleteSubscriber).toHaveBeenCalledWith('s1')
    })
    vi.unstubAllGlobals()
  })
})
