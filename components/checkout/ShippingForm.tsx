'use client'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

export interface ShippingFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  apartment?: string
  city: string
  state: string
  zipCode: string
  country: string
}

interface ShippingFormProps {
  data: ShippingFormData
  onChange: (data: ShippingFormData) => void
  errors: Partial<Record<keyof ShippingFormData, string>>
}

const US_STATES = [
  { value: '', label: 'Select State' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
]

export function ShippingForm({ data, onChange, errors }: ShippingFormProps) {
  const handleChange = (field: keyof ShippingFormData, value: string) => {
    onChange({ ...data, [field]: value })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Shipping Information</h2>

      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">Contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name"
            value={data.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            error={errors.firstName}
            required
          />
          <Input
            label="Last Name"
            value={data.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            error={errors.lastName}
            required
          />
        </div>
        <Input
          label="Email"
          type="email"
          value={data.email}
          onChange={(e) => handleChange('email', e.target.value)}
          error={errors.email}
          placeholder="your@email.com"
          required
        />
        <Input
          label="Phone"
          type="tel"
          value={data.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          error={errors.phone}
          placeholder="(555) 123-4567"
          required
        />
      </div>

      {/* Shipping Address */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">Shipping Address</h3>
        <Input
          label="Address"
          value={data.address}
          onChange={(e) => handleChange('address', e.target.value)}
          error={errors.address}
          placeholder="Street address"
          required
        />
        <Input
          label="Apartment, suite, etc."
          value={data.apartment || ''}
          onChange={(e) => handleChange('apartment', e.target.value)}
          error={errors.apartment}
          placeholder="Optional"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="City"
            value={data.city}
            onChange={(e) => handleChange('city', e.target.value)}
            error={errors.city}
            required
          />
          <Select
            label="State"
            value={data.state}
            onChange={(e) => handleChange('state', e.target.value)}
            error={errors.state}
            options={US_STATES}
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="ZIP Code"
            value={data.zipCode}
            onChange={(e) => handleChange('zipCode', e.target.value)}
            error={errors.zipCode}
            placeholder="12345"
            required
          />
          <Input
            label="Country"
            value={data.country}
            onChange={(e) => handleChange('country', e.target.value)}
            error={errors.country}
            disabled
            required
          />
        </div>
      </div>
    </div>
  )
}
