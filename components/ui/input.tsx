'use client'

import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        <label className="block text-sm font-semibold text-black mb-2">
          {label}
          {props.required && <span className="text-[#FF3131] ml-1">*</span>}
        </label>
        <input
          ref={ref}
          className={`
            w-full px-4 py-3.5 border bg-white text-black placeholder:text-black/40
            transition-all duration-200
            focus:ring-2 focus:ring-black focus:border-transparent focus:outline-none
            hover:border-black/30
            disabled:bg-black/5 disabled:text-black/50 disabled:cursor-not-allowed disabled:border-black/10
            ${error ? 'border-[#FF3131] ring-1 ring-[#FF3131]' : 'border-black/10'}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-[#FF3131] font-medium">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
