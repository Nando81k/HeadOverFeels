// tests/unit/components/admin/analytics/inspectors/ExpenseInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const createExpense = vi.fn()
const updateExpense = vi.fn()
const deleteExpense = vi.fn()

vi.mock('@/app/admin/analytics/actions', () => ({
  createExpense: (...args: unknown[]) => createExpense(...args),
  updateExpense: (...args: unknown[]) => updateExpense(...args),
  deleteExpense: (...args: unknown[]) => deleteExpense(...args),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { ExpenseInspector } from '@/components/admin/analytics/inspectors/ExpenseInspector'

const categories = [
  { id: 'cat1', name: 'Marketing', color: '#FF3131' },
  { id: 'cat2', name: 'Hosting', color: '#6366f1' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ExpenseInspector', () => {
  it('renders empty form in create mode', () => {
    render(
      <ExpenseInspector
        open
        detail={null}
        createMode
        categories={categories}
        isSuperAdmin
        onClose={() => {}}
        onSaved={() => {}}
      />
    )
    expect(screen.getByLabelText(/description/i)).toBeTruthy()
  })

  it('prefills values in edit mode', () => {
    render(
      <ExpenseInspector
        open
        detail={{
          id: 'e1',
          amount: 100, date: new Date('2026-05-15'),
          description: 'FB ads', vendor: 'Meta',
          receiptUrl: null, notes: null,
          isTaxDeductible: true, taxCategory: null,
          paymentMethod: 'card', isRecurring: false, recurringFrequency: null,
          status: 'PAID', invoiceId: null,
          category: { id: 'cat1', name: 'Marketing', slug: 'marketing', color: '#FF3131', icon: null },
          createdAt: new Date(), updatedAt: new Date(),
        }}
        categories={categories}
        isSuperAdmin
        onClose={() => {}}
        onSaved={() => {}}
      />
    )
    const desc = screen.getByLabelText(/description/i) as HTMLInputElement
    expect(desc.value).toBe('FB ads')
  })

  it('calls createExpense on save in create mode', async () => {
    createExpense.mockResolvedValue({ ok: true, data: { id: 'e2' } })
    const onSaved = vi.fn()
    render(
      <ExpenseInspector
        open
        detail={null}
        createMode
        categories={categories}
        isSuperAdmin
        onClose={() => {}}
        onSaved={onSaved}
      />
    )
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'New' } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(createExpense).toHaveBeenCalled())
    expect(onSaved).toHaveBeenCalledWith('e2')
  })

  it('disables Delete when not SUPER_ADMIN', () => {
    render(
      <ExpenseInspector
        open
        detail={{
          id: 'e1', amount: 50, date: new Date(), description: 'x', vendor: null,
          receiptUrl: null, notes: null, isTaxDeductible: false, taxCategory: null,
          paymentMethod: null, isRecurring: false, recurringFrequency: null,
          status: 'RECORDED', invoiceId: null,
          category: { id: 'cat1', name: 'Marketing', slug: 'marketing', color: '#FF3131', icon: null },
          createdAt: new Date(), updatedAt: new Date(),
        }}
        categories={categories}
        isSuperAdmin={false}
        onClose={() => {}}
        onSaved={() => {}}
      />
    )
    const del = screen.getByRole('button', { name: /delete/i }) as HTMLButtonElement
    expect(del.disabled).toBe(true)
    expect(del.title).toMatch(/SUPER_ADMIN/i)
  })
})
