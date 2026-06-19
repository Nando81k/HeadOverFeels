import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerNotes: vi.fn().mockResolvedValue([
    { id: 'n1', content: 'VIP customer', authorId: 'a1', authorName: 'Admin',
      isImportant: true, createdAt: new Date('2026-05-15'), updatedAt: new Date('2026-05-15') },
  ]),
}))

const deleteCustomerNote = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/app/admin/customers/actions', () => ({
  deleteCustomerNote: (...a: unknown[]) => deleteCustomerNote(...a),
}))

vi.mock('@/components/admin/customers/inspectors/NoteInspector', () => ({
  NoteInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="note-inspector" /> : null,
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { CustomerNotesPanel } from '@/components/admin/customers/detail/CustomerNotesPanel'

beforeEach(() => vi.clearAllMocks())

describe('CustomerNotesPanel', () => {
  it('renders notes with important star', async () => {
    const node = await CustomerNotesPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText('VIP customer')).toBeTruthy()
    expect(screen.getByText(/admin/i)).toBeTruthy()
    expect(screen.getByLabelText(/important/i)).toBeTruthy()
  })

  it('opens NoteInspector on + Add Note click', async () => {
    const node = await CustomerNotesPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    fireEvent.click(screen.getByRole('button', { name: /add note/i }))
    expect(screen.getByTestId('note-inspector')).toBeTruthy()
  })
})
