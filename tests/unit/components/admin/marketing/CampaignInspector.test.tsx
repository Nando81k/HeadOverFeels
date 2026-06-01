// tests/unit/components/admin/marketing/CampaignInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  duplicateCampaign: vi.fn(async () => ({ ok: true, data: { id: 'c2' } })),
  deleteCampaign: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/ui/Inspector', () => ({
  Inspector: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="inspector">{children}</div> : null,
}))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}))

const draft = {
  id: 'c1', name: 'May', subject: 'Hello May', preheader: 'Hi',
  heroImageUrl: null, ctaLabel: 'Shop', ctaUrl: '/',
  bodyMarkdown: 'Body', status: 'DRAFT' as const,
  audienceFilter: {}, audienceCount: 100, sentCount: 0, failedCount: 0,
  createdByAdminId: 'a1', sentAt: null,
  createdAt: new Date(), updatedAt: new Date(),
  recentTestDeliveries: [],
}

const sent = { ...draft, status: 'SENT' as const, sentCount: 100, sentAt: new Date() }

beforeEach(() => { vi.clearAllMocks() })

describe('CampaignInspector', () => {
  it('renders subject + audience + sent counts', async () => {
    const { CampaignInspector } = await import('@/components/admin/marketing/CampaignInspector')
    render(<CampaignInspector open detail={sent} onClose={vi.fn()} />)
    expect(screen.getByText('Hello May')).toBeInTheDocument()
    expect(screen.getByText('SENT')).toBeInTheDocument()
    // audienceCount=100 and sentCount=100 both render; use getAllByText
    expect(screen.getAllByText(/100/).length).toBeGreaterThanOrEqual(1)
  })

  it('Duplicate calls duplicateCampaign', async () => {
    const { CampaignInspector } = await import('@/components/admin/marketing/CampaignInspector')
    const { duplicateCampaign } = await import('@/app/admin/marketing/actions')
    render(<CampaignInspector open detail={sent} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Duplicate'))
    await waitFor(() => {
      expect(duplicateCampaign).toHaveBeenCalledWith('c1')
    })
  })

  it('Delete is disabled for non-DRAFT', async () => {
    const { CampaignInspector } = await import('@/components/admin/marketing/CampaignInspector')
    render(<CampaignInspector open detail={sent} onClose={vi.fn()} />)
    const btn = screen.getByText('Delete') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Delete is enabled + calls deleteCampaign for DRAFT', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    const { CampaignInspector } = await import('@/components/admin/marketing/CampaignInspector')
    const { deleteCampaign } = await import('@/app/admin/marketing/actions')
    render(<CampaignInspector open detail={draft} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Delete'))
    await waitFor(() => {
      expect(deleteCampaign).toHaveBeenCalledWith('c1')
    })
    vi.unstubAllGlobals()
  })

  it('renders Open editor → link to /admin/marketing/campaigns/c1/edit', async () => {
    const { CampaignInspector } = await import('@/components/admin/marketing/CampaignInspector')
    render(<CampaignInspector open detail={draft} onClose={vi.fn()} />)
    const link = screen.getByText(/open editor/i).closest('a')
    expect(link).toHaveAttribute('href', '/admin/marketing/campaigns/c1/edit')
  })
})
