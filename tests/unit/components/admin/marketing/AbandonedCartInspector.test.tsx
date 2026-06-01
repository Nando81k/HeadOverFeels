// tests/unit/components/admin/marketing/AbandonedCartInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('@/app/admin/marketing/actions', () => ({
  sendCartRecoveryEmail: vi.fn(async () => ({ ok: true })),
  generateCartRecoveryCode: vi.fn(async () => ({ ok: true, data: { code: 'NEWCODE1', promotionId: 'pNew' } })),
  markCartRecovered: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/ui/Inspector', () => ({
  Inspector: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="inspector">{children}</div> : null,
}))

const detail = {
  id: 'ac1',
  customerId: null,
  customerEmail: 'lost@e.com',
  customerName: 'Lost Shopper',
  items: [
    { productName: 'Tee', quantity: 2, price: 25, productImage: null, variantDetails: 'M / Black' },
    { productName: 'Hat', quantity: 1, price: 15, productImage: null, variantDetails: null },
  ],
  totalValue: 65,
  itemCount: 3,
  recoveryEmailSent: false,
  recoveryEmailSentAt: null,
  recovered: false,
  recoveredAt: null,
  recoveryOrderId: null,
  abandonedAt: new Date('2026-05-20'),
  expiresAt: new Date('2026-06-20'),
  discountCode: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('confirm', vi.fn(() => true))
})

describe('AbandonedCartInspector', () => {
  it('renders customer info + parsed items', async () => {
    const { AbandonedCartInspector } = await import('@/components/admin/marketing/AbandonedCartInspector')
    render(<AbandonedCartInspector open detail={detail} onClose={vi.fn()} />)
    expect(screen.getByText('Lost Shopper')).toBeInTheDocument()
    expect(screen.getByText('Tee')).toBeInTheDocument()
    expect(screen.getByText('Hat')).toBeInTheDocument()
  })

  it('Send Recovery Email calls sendCartRecoveryEmail', async () => {
    const { AbandonedCartInspector } = await import('@/components/admin/marketing/AbandonedCartInspector')
    const { sendCartRecoveryEmail } = await import('@/app/admin/marketing/actions')
    render(<AbandonedCartInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/send recovery/i))
    await waitFor(() => {
      expect(sendCartRecoveryEmail).toHaveBeenCalledWith('ac1')
    })
  })

  it('Generate Code shows the returned code', async () => {
    const { AbandonedCartInspector } = await import('@/components/admin/marketing/AbandonedCartInspector')
    render(<AbandonedCartInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/generate.*code/i))
    await waitFor(() => {
      expect(screen.getByText('NEWCODE1')).toBeInTheDocument()
    })
  })

  it('Mark Recovered calls markCartRecovered', async () => {
    const { AbandonedCartInspector } = await import('@/components/admin/marketing/AbandonedCartInspector')
    const { markCartRecovered } = await import('@/app/admin/marketing/actions')
    render(<AbandonedCartInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/mark recovered/i))
    await waitFor(() => {
      expect(markCartRecovered).toHaveBeenCalledWith('ac1')
    })
  })

  it('Send Recovery Email is disabled when recoveryEmailSent already true', async () => {
    const { AbandonedCartInspector } = await import('@/components/admin/marketing/AbandonedCartInspector')
    render(<AbandonedCartInspector open detail={{ ...detail, recoveryEmailSent: true }} onClose={vi.fn()} />)
    const btn = screen.getByText(/send recovery/i).closest('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})
