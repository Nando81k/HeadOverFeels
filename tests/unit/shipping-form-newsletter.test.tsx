import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ShippingForm, ShippingFormData } from '@/components/checkout/ShippingForm'

vi.mock('@/components/ui/AddressAutocomplete', () => ({
  AddressAutocomplete: ({
    label,
    value,
    onChange,
  }: {
    label: string
    value: string
    onChange: (value: string) => void
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  ),
}))

const baseData: ShippingFormData = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  newsletterOptIn: false,
  phone: '5551234567',
  address: '123 Main St',
  apartment: '',
  city: 'New York',
  state: 'NY',
  zipCode: '10001',
  country: 'United States',
}

describe('ShippingForm newsletter opt-in', () => {
  it('renders newsletter checkbox unchecked by default and updates on toggle', () => {
    const onChange = vi.fn()

    render(
      <ShippingForm
        data={baseData}
        onChange={onChange}
        errors={{}}
      />
    )

    const checkbox = screen.getByRole('checkbox')
    expect((checkbox as HTMLInputElement).checked).toBe(false)

    fireEvent.click(checkbox)

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        newsletterOptIn: true,
      })
    )
  })
})
