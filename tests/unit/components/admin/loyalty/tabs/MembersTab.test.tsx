import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getMemberDetailForInspector = vi.fn()
vi.mock('@/app/admin/loyalty/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/loyalty/actions')
  return { ...actual, getMemberDetailForInspector: (...a: unknown[]) => getMemberDetailForInspector(...a) }
})
vi.mock('@/components/admin/loyalty/inspectors/MemberInspector', () => ({
  MemberInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="member-inspector-open" /> : null,
}))
vi.mock('@/components/admin/loyalty/bulk/MembersBulkSheet', () => ({
  MembersBulkSheet: ({ selectedIds }: { selectedIds: string[] }) =>
    selectedIds.length > 0 ? <div data-testid="bulk-sheet" /> : null,
}))
vi.mock('@/components/admin/loyalty/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { MembersTab } from '@/components/admin/loyalty/tabs/MembersTab'

const data = {
  items: [
    { id: 'c1', email: 'a@e.com', name: 'Ada', tierId: 't1', tierName: 'Silver',
      tierColor: '#aaa', currentPoints: 250, lifetimePoints: 1500,
      annualPointsEarned: 800, lastOrderDate: new Date('2026-05-20'),
      tierStartDate: new Date('2026-01-01') },
  ],
  total: 1, page: 1, pageSize: 25,
}

beforeEach(() => vi.clearAllMocks())

describe('MembersTab', () => {
  it('renders table rows', () => {
    render(<MembersTab data={data} range="30d" isSuperAdmin />)
    expect(screen.getByText(/a@e\.com/)).toBeTruthy()
  })
  it('opens MemberInspector on row click', async () => {
    getMemberDetailForInspector.mockResolvedValue({ ...data.items[0], transactions: [] })
    render(<MembersTab data={data} range="30d" isSuperAdmin />)
    fireEvent.click(screen.getByText(/a@e\.com/))
    await waitFor(() => expect(screen.queryByTestId('member-inspector-open')).toBeTruthy())
  })
  it('shows BulkSheet when row selected', () => {
    render(<MembersTab data={data} range="30d" isSuperAdmin />)
    fireEvent.click(screen.getByLabelText(/select c1/i))
    expect(screen.getByTestId('bulk-sheet')).toBeTruthy()
  })
})
