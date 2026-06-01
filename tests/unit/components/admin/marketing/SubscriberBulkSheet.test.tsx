// tests/unit/components/admin/marketing/SubscriberBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  bulkUnsubscribeSubscribers: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkExportSubscribersCsv: vi.fn(async () => ({ ok: true, data: { csv: 'email,source\na@e.com,popup' } })),
  bulkDeleteSubscribers: vi.fn(async () => ({ ok: true, affected: 2 })),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/BottomActionSheet', () => ({
  BottomActionSheet: ({ actions, open }: {
    open: boolean
    actions: Array<{ label: string; onClick: () => void; disabled?: boolean }>
  }) => open ? (
    <div data-testid="bulk-sheet">
      {actions.map((a) => (
        <button key={a.label} onClick={a.onClick} disabled={a.disabled}>{a.label}</button>
      ))}
    </div>
  ) : null,
}))

beforeEach(() => { vi.clearAllMocks() })

describe('SubscriberBulkSheet', () => {
  it('renders 3 actions', async () => {
    const { SubscriberBulkSheet } = await import('@/components/admin/marketing/SubscriberBulkSheet')
    render(<SubscriberBulkSheet open ids={['s1']} isSuperAdmin={false} onClear={vi.fn()} />)
    expect(screen.getByText('Unsubscribe')).toBeInTheDocument()
    expect(screen.getByText('Export CSV')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('Delete is disabled when isSuperAdmin=false', async () => {
    const { SubscriberBulkSheet } = await import('@/components/admin/marketing/SubscriberBulkSheet')
    render(<SubscriberBulkSheet open ids={['s1']} isSuperAdmin={false} onClear={vi.fn()} />)
    expect((screen.getByText('Delete') as HTMLButtonElement).disabled).toBe(true)
  })

  it('Export CSV triggers download via blob', async () => {
    const { SubscriberBulkSheet } = await import('@/components/admin/marketing/SubscriberBulkSheet')
    const createObjectURL = vi.fn(() => 'blob:abc')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(window, 'URL', {
      value: { createObjectURL, revokeObjectURL }, configurable: true,
    })
    render(<SubscriberBulkSheet open ids={['s1']} isSuperAdmin onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Export CSV'))
    await waitFor(() => { expect(createObjectURL).toHaveBeenCalled() })
  })
})
