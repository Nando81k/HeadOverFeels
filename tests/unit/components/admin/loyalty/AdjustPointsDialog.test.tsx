// tests/unit/components/admin/loyalty/AdjustPointsDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const adjustMemberPoints = vi.fn()
const bulkAdjustMemberPoints = vi.fn()
vi.mock('@/app/admin/loyalty/actions', () => ({
  adjustMemberPoints: (...a: unknown[]) => adjustMemberPoints(...a),
  bulkAdjustMemberPoints: (...a: unknown[]) => bulkAdjustMemberPoints(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Inspector uses framer-motion — mock it to a simple div so jsdom doesn't choke
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    aside: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => <aside {...props}>{children}</aside>,
  },
}))

import { AdjustPointsDialog } from '@/components/admin/loyalty/AdjustPointsDialog'

beforeEach(() => vi.clearAllMocks())

describe('AdjustPointsDialog', () => {
  it('calls adjustMemberPoints in single mode', async () => {
    adjustMemberPoints.mockResolvedValue({ ok: true })
    render(<AdjustPointsDialog open memberIds={['c1']} isSuperAdmin onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'promo' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(adjustMemberPoints).toHaveBeenCalledWith('c1', 50, 'promo'))
  })

  it('calls bulkAdjustMemberPoints in bulk mode', async () => {
    bulkAdjustMemberPoints.mockResolvedValue({ ok: true, data: { succeeded: ['c1', 'c2'], failed: [] } })
    render(<AdjustPointsDialog open memberIds={['c1', 'c2']} isSuperAdmin onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'bulk promo' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(bulkAdjustMemberPoints).toHaveBeenCalledWith(['c1', 'c2'], 100, 'bulk promo'))
  })

  it('disables Submit in bulk mode for non-SUPER_ADMIN', () => {
    render(<AdjustPointsDialog open memberIds={['c1', 'c2']} isSuperAdmin={false} onClose={() => {}} />)
    const btn = screen.getByRole('button', { name: /submit/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toMatch(/SUPER_ADMIN/i)
  })

  it('rejects empty reason', () => {
    render(<AdjustPointsDialog open memberIds={['c1']} isSuperAdmin onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(adjustMemberPoints).not.toHaveBeenCalled()
  })
})
