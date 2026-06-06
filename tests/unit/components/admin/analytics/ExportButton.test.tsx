import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const exportOverviewCsv = vi.fn()
const exportSalesCsv = vi.fn()
const exportCustomersCsv = vi.fn()
const exportProductsCsv = vi.fn()
const exportFinancialCsv = vi.fn()
const exportExpensesCsv = vi.fn()

vi.mock('@/app/admin/analytics/actions', () => ({
  exportOverviewCsv: (...a: unknown[]) => exportOverviewCsv(...a),
  exportSalesCsv: (...a: unknown[]) => exportSalesCsv(...a),
  exportCustomersCsv: (...a: unknown[]) => exportCustomersCsv(...a),
  exportProductsCsv: (...a: unknown[]) => exportProductsCsv(...a),
  exportFinancialCsv: (...a: unknown[]) => exportFinancialCsv(...a),
  exportExpensesCsv: (...a: unknown[]) => exportExpensesCsv(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { ExportButton } from '@/components/admin/analytics/ExportButton'

beforeEach(() => {
  vi.clearAllMocks()
  const createObjectURL = vi.fn(() => 'blob:mock')
  const revokeObjectURL = vi.fn()
  Object.assign(URL, { createObjectURL, revokeObjectURL })
})

describe('ExportButton', () => {
  it('calls exportOverviewCsv when tab is overview', async () => {
    exportOverviewCsv.mockResolvedValue({ ok: true, data: { csv: 'a,b\n1,2' } })
    render(<ExportButton tab="overview" range="30d" />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => expect(exportOverviewCsv).toHaveBeenCalledWith('30d'))
  })

  it('calls exportExpensesCsv with filters', async () => {
    exportExpensesCsv.mockResolvedValue({ ok: true, data: { csv: 'a' } })
    render(<ExportButton tab="expenses" range="30d" filters={{ categoryId: 'cat1' }} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => expect(exportExpensesCsv).toHaveBeenCalledWith('30d', { categoryId: 'cat1' }))
  })

  it('surfaces error toast on failure', async () => {
    const { toast } = await import('@/lib/toast')
    exportSalesCsv.mockResolvedValue({ ok: false, error: 'Too many rows' })
    render(<ExportButton tab="sales" range="year" />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Too many rows'))
  })
})
