'use client'

import { SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  options: Array<{ value: string; label: string }>
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        <label className="block text-sm font-semibold text-black mb-2">
          {label}
          {props.required && <span className="text-[#FF3131] ml-1">*</span>}
        </label>
        <select
          ref={ref}
          className={`
            w-full px-4 py-3.5 border rounded-xl bg-white text-black
            transition-all duration-200 appearance-none
            focus:ring-2 focus:ring-black focus:border-transparent focus:outline-none
            hover:border-black/30
            disabled:bg-black/5 disabled:text-black/50 disabled:cursor-not-allowed disabled:border-black/10
            ${error ? 'border-[#FF3131] ring-1 ring-[#FF3131]' : 'border-black/10'}
            ${className}
          `}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23000' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 12px center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '20px',
            paddingRight: '44px',
          }}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1.5 text-sm text-[#FF3131] font-medium">{error}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'
