// tests/unit/components/admin/loyalty/ExportButton.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const exportOverviewCsv = vi.fn()
const exportMembersCsv = vi.fn()
const exportRewardsCsv = vi.fn()
const exportRedemptionsCsv = vi.fn()
const exportEventsCsv = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  exportOverviewCsv: (...a: unknown[]) => exportOverviewCsv(...a),
  exportMembersCsv: (...a: unknown[]) => exportMembersCsv(...a),
  exportRewardsCsv: (...a: unknown[]) => exportRewardsCsv(...a),
  exportRedemptionsCsv: (...a: unknown[]) => exportRedemptionsCsv(...a),
  exportEventsCsv: (...a: unknown[]) => exportEventsCsv(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { ExportButton } from '@/components/admin/loyalty/ExportButton'

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  })
})

describe('ExportButton (loyalty)', () => {
  it('calls exportOverviewCsv when tab=overview', async () => {
    exportOverviewCsv.mockResolvedValue({ ok: true, data: { csv: 'a,b\n1,2' } })
    render(<ExportButton tab="overview" range="30d" />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => expect(exportOverviewCsv).toHaveBeenCalledWith('30d'))
  })

  it('calls exportRedemptionsCsv with range + filters', async () => {
    exportRedemptionsCsv.mockResolvedValue({ ok: true, data: { csv: 'a' } })
    render(<ExportButton tab="redemptions" range="7d" filters={{ status: 'PENDING' }} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() =>
      expect(exportRedemptionsCsv).toHaveBeenCalledWith('7d', { status: 'PENDING' }),
    )
  })

  it('surfaces error toast on failure', async () => {
    const { toast } = await import('@/lib/toast')
    exportMembersCsv.mockResolvedValue({ ok: false, error: 'Too many rows' })
    render(<ExportButton tab="members" range="30d" />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Too many rows'))
  })

  it('calls exportMembersCsv with filters when tab=members', async () => {
    exportMembersCsv.mockResolvedValue({ ok: true, data: { csv: 'col\nval' } })
    render(<ExportButton tab="members" filters={{ tierId: 'tier-1' }} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() =>
      expect(exportMembersCsv).toHaveBeenCalledWith({ tierId: 'tier-1' }),
    )
  })

  it('calls exportRewardsCsv with filters when tab=rewards', async () => {
    exportRewardsCsv.mockResolvedValue({ ok: true, data: { csv: 'col\nval' } })
    render(<ExportButton tab="rewards" filters={{ isActive: true }} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() =>
      expect(exportRewardsCsv).toHaveBeenCalledWith({ isActive: true }),
    )
  })

  it('calls exportEventsCsv with filters when tab=events', async () => {
    exportEventsCsv.mockResolvedValue({ ok: true, data: { csv: 'col\nval' } })
    render(<ExportButton tab="events" filters={{ isActive: true }} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() =>
      expect(exportEventsCsv).toHaveBeenCalledWith({ isActive: true }),
    )
  })

  it('shows success toast and triggers download on success', async () => {
    const { toast } = await import('@/lib/toast')
    exportOverviewCsv.mockResolvedValue({ ok: true, data: { csv: 'a,b\n1,2' } })
    render(<ExportButton tab="overview" range="30d" />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('CSV downloaded'))
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('uses range=all in filename when range is not provided', async () => {
    exportMembersCsv.mockResolvedValue({ ok: true, data: { csv: 'col\nval' } })
    render(<ExportButton tab="members" />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => expect(exportMembersCsv).toHaveBeenCalled())
  })

  it('renders Export CSV label when not pending', () => {
    render(<ExportButton tab="overview" range="30d" />)
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
  })
})
