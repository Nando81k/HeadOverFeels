import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const anonymizeCustomer = vi.fn()
vi.mock('@/app/admin/customers/actions', () => ({
  anonymizeCustomer: (...a: unknown[]) => anonymizeCustomer(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { AnonymizeConfirmDialog } from '@/components/admin/customers/inspectors/AnonymizeConfirmDialog'

beforeEach(() => vi.clearAllMocks())

describe('AnonymizeConfirmDialog', () => {
  it('Confirm button disabled until email matches', () => {
    render(
      <AnonymizeConfirmDialog
        open
        customerId="c1"
        customerEmail="ada@e.com"
        onClose={() => {}}
      />,
    )
    const btn = screen.getByRole('button', { name: /^anonymize$/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/type the email/i), {
      target: { value: 'ada@e.com' },
    })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('confirm calls anonymizeCustomer + closes on success', async () => {
    anonymizeCustomer.mockResolvedValue({ ok: true })
    const onClose = vi.fn()
    render(
      <AnonymizeConfirmDialog
        open
        customerId="c1"
        customerEmail="ada@e.com"
        onClose={onClose}
      />,
    )
    fireEvent.change(screen.getByLabelText(/type the email/i), {
      target: { value: 'ADA@e.com  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^anonymize$/i }))
    await waitFor(() => expect(anonymizeCustomer).toHaveBeenCalledWith('c1', 'ADA@e.com  '))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <AnonymizeConfirmDialog
        open={false}
        customerId="c1"
        customerEmail="ada@e.com"
        onClose={() => {}}
      />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
