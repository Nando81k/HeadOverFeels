// tests/unit/components/admin/marketing/AbandonedCartBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  bulkSendRecoveryEmails: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkGenerateRecoveryCodes: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkMarkCartsRecovered: vi.fn(async () => ({ ok: true, affected: 2 })),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/BottomActionSheet', () => ({
  BottomActionSheet: ({ actions, open }: {
    open: boolean
    actions: Array<{ label: string; onClick: () => void }>
  }) => open ? (
    <div data-testid="bulk-sheet">
      {actions.map((a) => (
        <button key={a.label} onClick={a.onClick}>{a.label}</button>
      ))}
    </div>
  ) : null,
}))

beforeEach(() => { vi.clearAllMocks() })

describe('AbandonedCartBulkSheet', () => {
  it('renders 3 actions', async () => {
    const { AbandonedCartBulkSheet } = await import('@/components/admin/marketing/AbandonedCartBulkSheet')
    render(<AbandonedCartBulkSheet open ids={['ac1']} onClear={vi.fn()} />)
    expect(screen.getByText('Send Recovery')).toBeInTheDocument()
    expect(screen.getByText('Generate Codes')).toBeInTheDocument()
    expect(screen.getByText('Mark Recovered')).toBeInTheDocument()
  })

  it('Send Recovery calls bulkSendRecoveryEmails', async () => {
    const { AbandonedCartBulkSheet } = await import('@/components/admin/marketing/AbandonedCartBulkSheet')
    const { bulkSendRecoveryEmails } = await import('@/app/admin/marketing/actions')
    render(<AbandonedCartBulkSheet open ids={['ac1', 'ac2']} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Send Recovery'))
    await waitFor(() => { expect(bulkSendRecoveryEmails).toHaveBeenCalledWith(['ac1', 'ac2']) })
  })

  it('Generate Codes shows confirm prompt and calls bulkGenerateRecoveryCodes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { AbandonedCartBulkSheet } = await import('@/components/admin/marketing/AbandonedCartBulkSheet')
    const { bulkGenerateRecoveryCodes } = await import('@/app/admin/marketing/actions')
    render(<AbandonedCartBulkSheet open ids={['ac1', 'ac2']} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Generate Codes'))
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Generate one-time 10%-off codes for 2 carts?')
      expect(bulkGenerateRecoveryCodes).toHaveBeenCalledWith(['ac1', 'ac2'])
    })
  })

  it('Generate Codes does NOT call action when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { AbandonedCartBulkSheet } = await import('@/components/admin/marketing/AbandonedCartBulkSheet')
    const { bulkGenerateRecoveryCodes } = await import('@/app/admin/marketing/actions')
    render(<AbandonedCartBulkSheet open ids={['ac1']} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Generate Codes'))
    await waitFor(() => { expect(bulkGenerateRecoveryCodes).not.toHaveBeenCalled() })
  })

  it('Mark Recovered shows confirm prompt and calls bulkMarkCartsRecovered', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { AbandonedCartBulkSheet } = await import('@/components/admin/marketing/AbandonedCartBulkSheet')
    const { bulkMarkCartsRecovered } = await import('@/app/admin/marketing/actions')
    render(<AbandonedCartBulkSheet open ids={['ac1']} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Mark Recovered'))
    await waitFor(() => { expect(bulkMarkCartsRecovered).toHaveBeenCalledWith(['ac1']) })
  })

  it('does not render when open is false', async () => {
    const { AbandonedCartBulkSheet } = await import('@/components/admin/marketing/AbandonedCartBulkSheet')
    render(<AbandonedCartBulkSheet open={false} ids={['ac1']} onClear={vi.fn()} />)
    expect(screen.queryByTestId('bulk-sheet')).not.toBeInTheDocument()
  })
})
