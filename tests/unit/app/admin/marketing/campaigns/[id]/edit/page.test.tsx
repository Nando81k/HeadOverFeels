import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock editor — Tasks 21/22 build the real component in parallel; use a stub here
// so the dispatcher tests are fully self-contained.
vi.mock('@/components/admin/marketing/editor/CampaignEditor', () => ({
  CampaignEditor: () => 'CampaignEditor',
}))

// Mock next/navigation so redirect / notFound are assertable
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

// Base marketing mock — can be overridden per test via vi.doMock
vi.mock('@/lib/admin/marketing', () => ({
  loadCampaignDetail: vi.fn(),
}))

const FIXTURE = {
  id: 'camp-1',
  name: 'Spring Sale',
  subject: 'Big Spring Sale!',
  status: 'DRAFT' as const,
  audienceCount: 500,
  sentCount: 0,
  failedCount: 0,
  sentAt: null,
  createdAt: new Date('2025-01-01'),
  preheader: null,
  heroImageUrl: null,
  ctaLabel: null,
  ctaUrl: null,
  bodyMarkdown: '# Hello',
  audienceFilter: null,
  createdByAdminId: 'admin-1',
  updatedAt: new Date('2025-01-02'),
  recentTestDeliveries: [],
}

beforeEach(() => {
  vi.resetModules()
})

describe('admin/marketing/campaigns/[id]/edit dispatcher', () => {
  it('redirects to /admin/newsletter when flag is disabled', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { redirect } = await import('next/navigation')
    const mod = await import('@/app/admin/marketing/campaigns/[id]/edit/page')
    await expect(mod.default({ params: Promise.resolve({ id: 'camp-1' }) })).rejects.toThrow(
      'REDIRECT:/admin/newsletter',
    )
    expect(redirect).toHaveBeenCalledWith('/admin/newsletter')
  })

  it('calls notFound when loadCampaignDetail returns null', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/lib/admin/marketing', () => ({
      loadCampaignDetail: vi.fn().mockResolvedValue(null),
    }))
    const { notFound } = await import('next/navigation')
    const mod = await import('@/app/admin/marketing/campaigns/[id]/edit/page')
    await expect(mod.default({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow(
      'NOT_FOUND',
    )
    expect(notFound).toHaveBeenCalled()
  })

  it('renders CampaignEditor with detail when flag is enabled and detail exists', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const mockLoad = vi.fn().mockResolvedValue(FIXTURE)
    vi.doMock('@/lib/admin/marketing', () => ({
      loadCampaignDetail: mockLoad,
    }))
    vi.doMock('@/components/admin/marketing/editor/CampaignEditor', () => ({
      CampaignEditor: ({ detail }: { detail: typeof FIXTURE }) => (
        <div data-testid="campaign-editor">{detail.id}</div>
      ),
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/marketing/campaigns/[id]/edit/page')
    const result = await mod.default({ params: Promise.resolve({ id: 'camp-1' }) })
    render(result)
    expect(screen.getByTestId('campaign-editor')).toBeInTheDocument()
    expect(screen.getByTestId('campaign-editor').textContent).toBe('camp-1')
  })

  it('passes the correct id to loadCampaignDetail', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const mockLoad = vi.fn().mockResolvedValue(FIXTURE)
    vi.doMock('@/lib/admin/marketing', () => ({
      loadCampaignDetail: mockLoad,
    }))
    vi.doMock('@/components/admin/marketing/editor/CampaignEditor', () => ({
      CampaignEditor: () => <div data-testid="campaign-editor" />,
    }))
    const { render } = await import('@testing-library/react')
    const mod = await import('@/app/admin/marketing/campaigns/[id]/edit/page')
    render(await mod.default({ params: Promise.resolve({ id: 'camp-42' }) }))
    expect(mockLoad).toHaveBeenCalledWith('camp-42')
  })

  it('exports revalidate = 60', async () => {
    const mod = await import('@/app/admin/marketing/campaigns/[id]/edit/page')
    expect(mod.revalidate).toBe(60)
  })
})
