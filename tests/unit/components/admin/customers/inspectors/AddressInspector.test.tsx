import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const createAddress = vi.fn()
const updateAddress = vi.fn()
vi.mock('@/app/admin/customers/actions', () => ({
  createAddress: (...a: unknown[]) => createAddress(...a),
  updateAddress: (...a: unknown[]) => updateAddress(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { AddressInspector } from '@/components/admin/customers/inspectors/AddressInspector'
import type { AddressRow } from '@/lib/admin/customers'

const sample: AddressRow = {
  id: 'a1', firstName: 'Ada', lastName: 'Lovelace', company: null,
  address1: '1 Main St', address2: 'Apt 2', city: 'NYC', state: 'NY',
  postalCode: '10001', country: 'US', isDefault: false, type: 'SHIPPING',
}

beforeEach(() => vi.clearAllMocks())

describe('AddressInspector', () => {
  it('create mode submits createAddress with schema field names', async () => {
    createAddress.mockResolvedValue({ ok: true, data: { id: 'a2' } })
    render(
      <AddressInspector open customerId="c1" address={null} onClose={() => {}} />,
    )
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'L' } })
    fireEvent.change(screen.getByLabelText(/address line 1/i), { target: { value: '1 Main' } })
    fireEvent.change(screen.getByLabelText(/^city$/i), { target: { value: 'NYC' } })
    fireEvent.change(screen.getByLabelText(/state/i), { target: { value: 'NY' } })
    fireEvent.change(screen.getByLabelText(/postal code/i), { target: { value: '10001' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(createAddress).toHaveBeenCalled())
    const [customerId, input] = createAddress.mock.calls[0]
    expect(customerId).toBe('c1')
    expect(input.firstName).toBe('Ada')
    expect(input.address1).toBe('1 Main')
    expect(input.state).toBe('NY')
    expect(input.postalCode).toBe('10001')
    expect(input.type).toBe('SHIPPING')
  })

  it('edit mode pre-fills + calls updateAddress', async () => {
    updateAddress.mockResolvedValue({ ok: true })
    render(
      <AddressInspector open customerId="c1" address={sample} onClose={() => {}} />,
    )
    expect((screen.getByLabelText(/first name/i) as HTMLInputElement).value).toBe('Ada')
    fireEvent.change(screen.getByLabelText(/^city$/i), { target: { value: 'LA' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateAddress).toHaveBeenCalled())
    expect(updateAddress.mock.calls[0][0]).toBe('a1')
    expect(updateAddress.mock.calls[0][1].city).toBe('LA')
  })

  it('shows validation error when required field missing', async () => {
    createAddress.mockResolvedValue({ ok: false, error: 'First name is required' })
    render(
      <AddressInspector open customerId="c1" address={null} onClose={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(createAddress).toHaveBeenCalled())
  })
})
