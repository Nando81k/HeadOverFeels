import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock editor — Tasks 21/22 build the real component in parallel; use a stub here
// so the dispatcher tests are fully self-contained.
vi.mock('@/components/admin/marketing/editor/PopupEditor', () => ({
  PopupEditor: () => 'PopupEditor',
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
  loadPopupDetail: vi.fn(),
}))

const FIXTURE = {
  id: 'popup-1',
  name: 'Welcome Popup',
  template: 'MODAL' as const,
  position: 'CENTER' as const,
  triggerType: 'DELAY' as const,
  isActive: true,
  priority: 1,
  startDate: null,
  endDate: null,
  createdAt: new Date('2025-01-01'),
  content: '<p>Welcome!</p>',
  triggerValue: 3000,
  showOnPages: '/',
  showToNewVisitors: true,
  showToReturning: false,
  frequency: 'ONCE_PER_SESSION' as const,
  promotionId: null,
  updatedAt: new Date('2025-01-02'),
  variants: [],
  analytics7d: { impressions: 0, clicks: 0, dismissals: 0, conversions: 0 },
}

beforeEach(() => {
  vi.resetModules()
})

describe('admin/marketing/popups/[id]/edit dispatcher', () => {
  it('redirects to /admin/popups/:id when flag is disabled', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { redirect } = await import('next/navigation')
    const mod = await import('@/app/admin/marketing/popups/[id]/edit/page')
    await expect(mod.default({ params: Promise.resolve({ id: 'popup-1' }) })).rejects.toThrow(
      'REDIRECT:/admin/popups/popup-1',
    )
    expect(redirect).toHaveBeenCalledWith('/admin/popups/popup-1')
  })

  it('calls notFound when loadPopupDetail returns null', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/lib/admin/marketing', () => ({
      loadPopupDetail: vi.fn().mockResolvedValue(null),
    }))
    const { notFound } = await import('next/navigation')
    const mod = await import('@/app/admin/marketing/popups/[id]/edit/page')
    await expect(mod.default({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow(
      'NOT_FOUND',
    )
    expect(notFound).toHaveBeenCalled()
  })

  it('renders PopupEditor with detail when flag is enabled and detail exists', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const mockLoad = vi.fn().mockResolvedValue(FIXTURE)
    vi.doMock('@/lib/admin/marketing', () => ({
      loadPopupDetail: mockLoad,
    }))
    vi.doMock('@/components/admin/marketing/editor/PopupEditor', () => ({
      PopupEditor: ({ detail }: { detail: typeof FIXTURE }) => (
        <div data-testid="popup-editor">{detail.id}</div>
      ),
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/marketing/popups/[id]/edit/page')
    const result = await mod.default({ params: Promise.resolve({ id: 'popup-1' }) })
    render(result)
    expect(screen.getByTestId('popup-editor')).toBeInTheDocument()
    expect(screen.getByTestId('popup-editor').textContent).toBe('popup-1')
  })

  it('passes the correct id to loadPopupDetail', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const mockLoad = vi.fn().mockResolvedValue(FIXTURE)
    vi.doMock('@/lib/admin/marketing', () => ({
      loadPopupDetail: mockLoad,
    }))
    vi.doMock('@/components/admin/marketing/editor/PopupEditor', () => ({
      PopupEditor: () => <div data-testid="popup-editor" />,
    }))
    const { render } = await import('@testing-library/react')
    const mod = await import('@/app/admin/marketing/popups/[id]/edit/page')
    render(await mod.default({ params: Promise.resolve({ id: 'popup-99' }) }))
    expect(mockLoad).toHaveBeenCalledWith('popup-99')
  })

  it('redirect includes the popup id in the target URL when flag is disabled', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { redirect } = await import('next/navigation')
    const mod = await import('@/app/admin/marketing/popups/[id]/edit/page')
    await expect(mod.default({ params: Promise.resolve({ id: 'popup-XYZ' }) })).rejects.toThrow(
      'REDIRECT:/admin/popups/popup-XYZ',
    )
    expect(redirect).toHaveBeenCalledWith('/admin/popups/popup-XYZ')
  })

  it('exports revalidate = 60', async () => {
    const mod = await import('@/app/admin/marketing/popups/[id]/edit/page')
    expect(mod.revalidate).toBe(60)
  })
})
