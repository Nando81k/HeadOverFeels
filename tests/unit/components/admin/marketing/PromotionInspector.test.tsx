// tests/unit/components/admin/marketing/PromotionInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  updatePromotion: vi.fn(async () => ({ ok: true })),
  togglePromotionActive: vi.fn(async () => ({ ok: true })),
  suggestPromotionCode: vi.fn(async () => ({ ok: true, data: { code: 'SUGG1234' } })),
  checkPromotionCodeUnique: vi.fn(async () => ({ ok: true, data: { unique: true } })),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/ui/Inspector', () => ({
  Inspector: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="inspector">{children}</div> : null,
}))

const detail = {
  id: 'p1', name: 'Summer 20', description: null, code: 'SUMMER20',
  type: 'PERCENTAGE' as const, value: 20, autoApply: false, stackable: false,
  minimumPurchase: 50, maxUsesTotal: 100, maxUsesPerCustomer: 1, usedCount: 12,
  productIds: null, collectionIds: null, customerEmails: null,
  startDate: new Date('2026-05-01'), endDate: new Date('2026-06-01'),
  isActive: true, maxDiscountPercent: null, excludeFromLoyalty: false,
  totalDiscountGiven: 1234.5,
  createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01'),
}

beforeEach(() => { vi.clearAllMocks() })

describe('PromotionInspector', () => {
  it('renders empty when detail is null', async () => {
    const { PromotionInspector } = await import('@/components/admin/marketing/PromotionInspector')
    render(<PromotionInspector open detail={null} onClose={vi.fn()} />)
    expect(screen.queryByTestId('inspector')).toBeInTheDocument()
  })

  it('renders form fields with detail values', async () => {
    const { PromotionInspector } = await import('@/components/admin/marketing/PromotionInspector')
    render(<PromotionInspector open detail={detail} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('Summer 20')).toBeInTheDocument()
    expect(screen.getByDisplayValue('SUMMER20')).toBeInTheDocument()
  })

  it('Suggest button populates code field via suggestPromotionCode', async () => {
    const { PromotionInspector } = await import('@/components/admin/marketing/PromotionInspector')
    render(<PromotionInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Suggest'))
    await waitFor(() => {
      expect((screen.getByLabelText(/code/i) as HTMLInputElement).value).toBe('SUGG1234')
    })
  })

  it('Save calls updatePromotion with edited values', async () => {
    const { PromotionInspector } = await import('@/components/admin/marketing/PromotionInspector')
    const { updatePromotion } = await import('@/app/admin/marketing/actions')
    render(<PromotionInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Spring 25' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(updatePromotion).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Spring 25' }))
    })
  })

  it('Activate toggle flips isActive via togglePromotionActive', async () => {
    const { PromotionInspector } = await import('@/components/admin/marketing/PromotionInspector')
    const { togglePromotionActive } = await import('@/app/admin/marketing/actions')
    render(<PromotionInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(/active/i))
    await waitFor(() => {
      expect(togglePromotionActive).toHaveBeenCalledWith('p1')
    })
  })
})
