import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerAddresses: vi.fn().mockResolvedValue([
    { id: 'a1', firstName: 'Ada', lastName: 'Lovelace', company: null,
      address1: '1 Main St', address2: 'Apt 2', city: 'NYC', state: 'NY',
      postalCode: '10001', country: 'US', isDefault: true, type: 'SHIPPING' },
    { id: 'a2', firstName: 'Ada', lastName: 'Lovelace', company: null,
      address1: '2nd St', address2: null, city: 'NYC', state: 'NY',
      postalCode: '10002', country: 'US', isDefault: false, type: 'BILLING' },
  ]),
}))

const deleteAddress = vi.fn().mockResolvedValue({ ok: true })
const setDefaultAddress = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/app/admin/customers/actions', () => ({
  deleteAddress: (...a: unknown[]) => deleteAddress(...a),
  setDefaultAddress: (...a: unknown[]) => setDefaultAddress(...a),
}))

vi.mock('@/components/admin/customers/inspectors/AddressInspector', () => ({
  AddressInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="address-inspector" /> : null,
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { CustomerAddressesPanel } from '@/components/admin/customers/detail/CustomerAddressesPanel'

beforeEach(() => vi.clearAllMocks())

describe('CustomerAddressesPanel', () => {
  it('renders address rows with default badge', async () => {
    const node = await CustomerAddressesPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/1 Main St/)).toBeTruthy()
    // Default badge (exact match avoids colliding with the "Set default" button)
    expect(screen.getByText('Default')).toBeTruthy()
  })

  it('opens AddressInspector on + Add Address click', async () => {
    const node = await CustomerAddressesPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    fireEvent.click(screen.getByRole('button', { name: /add address/i }))
    expect(screen.getByTestId('address-inspector')).toBeTruthy()
  })

  it('Set Default button hidden when address is already default', async () => {
    const node = await CustomerAddressesPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    const setDefaultButtons = screen.getAllByRole('button', { name: /set default/i })
    expect(setDefaultButtons).toHaveLength(1)
  })
})
