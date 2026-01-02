'use client'

import { Input } from '@/components/ui/input'
import { formatPhoneNumber } from '@/lib/utils/phone'
import { ChangeEvent } from 'react'

interface PhoneInputProps {
  label?: string
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  error?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export function PhoneInput({
  label = 'Phone',
  value,
  onChange,
  error,
  placeholder = '(555) 123-4567',
  required = false,
  disabled = false,
  className,
}: PhoneInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const formatted = formatPhoneNumber(input)
    
    // Create a new event with the formatted value
    const formattedEvent = {
      ...e,
      target: {
        ...e.target,
        value: formatted,
      },
    } as ChangeEvent<HTMLInputElement>
    
    onChange(formattedEvent)
  }

  return (
    <Input
      label={label}
      type="tel"
      value={value}
      onChange={handleChange}
      error={error}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={className}
      maxLength={14} // (XXX) XXX-XXXX = 14 characters
    />
  )
}
