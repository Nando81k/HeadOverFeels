import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const createCustomerNote = vi.fn()
const updateCustomerNote = vi.fn()
vi.mock('@/app/admin/customers/actions', () => ({
  createCustomerNote: (...a: unknown[]) => createCustomerNote(...a),
  updateCustomerNote: (...a: unknown[]) => updateCustomerNote(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { NoteInspector } from '@/components/admin/customers/inspectors/NoteInspector'
import type { CustomerNoteRow } from '@/lib/admin/customers'

const sample: CustomerNoteRow = {
  id: 'n1', content: 'VIP', authorId: 'a1', authorName: 'Admin',
  isImportant: true, createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('NoteInspector', () => {
  it('create mode calls createCustomerNote with isImportant flag', async () => {
    createCustomerNote.mockResolvedValue({ ok: true, data: { id: 'n2' } })
    render(
      <NoteInspector open customerId="c1" note={null} onClose={() => {}} />,
    )
    fireEvent.change(screen.getByLabelText(/content/i), { target: { value: 'New note' } })
    fireEvent.click(screen.getByLabelText(/important/i))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(createCustomerNote).toHaveBeenCalled())
    expect(createCustomerNote).toHaveBeenCalledWith('c1', 'New note', true)
  })

  it('edit mode pre-fills + calls updateCustomerNote', async () => {
    updateCustomerNote.mockResolvedValue({ ok: true })
    render(
      <NoteInspector open customerId="c1" note={sample} onClose={() => {}} />,
    )
    expect((screen.getByLabelText(/content/i) as HTMLTextAreaElement).value).toBe('VIP')
    fireEvent.change(screen.getByLabelText(/content/i), { target: { value: 'Updated' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateCustomerNote).toHaveBeenCalled())
    expect(updateCustomerNote).toHaveBeenCalledWith('n1', 'Updated', true)
  })

  it('rejects empty content client-side', async () => {
    render(
      <NoteInspector open customerId="c1" note={null} onClose={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(createCustomerNote).not.toHaveBeenCalled()
  })
})
