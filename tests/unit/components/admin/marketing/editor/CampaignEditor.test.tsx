// tests/unit/components/admin/marketing/editor/CampaignEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  updateCampaignDraft: vi.fn(async () => ({ ok: true })),
  queueCampaignSend: vi.fn(async () => ({ ok: true })),
  sendCampaignTest: vi.fn(async () => ({ ok: true })),
  previewCampaignAudience: vi.fn(async () => ({ ok: true, data: { count: 42 } })),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const detail = {
  id: 'c1', name: 'May', subject: 'Hello May', preheader: 'Hi',
  heroImageUrl: null, ctaLabel: 'Shop', ctaUrl: '/',
  bodyMarkdown: 'Body text',
  status: 'DRAFT' as const,
  audienceFilter: { activeOnly: true },
  audienceCount: 0, sentCount: 0, failedCount: 0,
  createdByAdminId: 'a', sentAt: null,
  createdAt: new Date(), updatedAt: new Date(),
  recentTestDeliveries: [
    { id: 'd1', email: 'tester@e.com', status: 'SENT' as const, isTest: true,
      sentAt: new Date(), providerMessageId: 'm1', errorMessage: null },
  ],
}

beforeEach(() => { vi.clearAllMocks() })

describe('CampaignEditor', () => {
  it('renders all editable fields with initial values', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    expect(screen.getByDisplayValue('Hello May')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Hi')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Body text')).toBeInTheDocument()
  })

  it('Save Draft calls updateCampaignDraft', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    const { updateCampaignDraft } = await import('@/app/admin/marketing/actions')
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Updated subject' } })
    fireEvent.click(screen.getByText('Save Draft'))
    await waitFor(() => {
      expect(updateCampaignDraft).toHaveBeenCalledWith('c1', expect.objectContaining({ subject: 'Updated subject' }))
    })
  })

  it('Send Test calls sendCampaignTest with email', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    const { sendCampaignTest } = await import('@/app/admin/marketing/actions')
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    fireEvent.change(screen.getByPlaceholderText(/test email/i), { target: { value: 'qa@e.com' } })
    fireEvent.click(screen.getByText('Send Test'))
    await waitFor(() => {
      expect(sendCampaignTest).toHaveBeenCalledWith('c1', 'qa@e.com')
    })
  })

  it('Queue Send calls queueCampaignSend', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    const { queueCampaignSend } = await import('@/app/admin/marketing/actions')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    fireEvent.click(screen.getByText('Queue Send'))
    await waitFor(() => { expect(queueCampaignSend).toHaveBeenCalledWith('c1') })
  })

  it('Preview Audience shows the returned count', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    fireEvent.click(screen.getByText(/preview audience/i))
    await waitFor(() => {
      expect(screen.getByText(/42 subscribers/i)).toBeInTheDocument()
    })
  })

  it('renders recent test deliveries in delivery log', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    expect(screen.getByText('tester@e.com')).toBeInTheDocument()
  })

  it('renders live preview pane with subject + body', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    expect(screen.getByTestId('campaign-live-preview')).toHaveTextContent('Hello May')
    expect(screen.getByTestId('campaign-live-preview')).toHaveTextContent('Body text')
  })
})
