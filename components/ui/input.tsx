'use client'

import { InputHTMLAttributes, forwardRef, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  helperText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    const describedBy = error ? errorId : helperText ? helperId : undefined

    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className="block text-[10px] font-black uppercase tracking-[0.16em] text-black/65 mb-2"
        >
          {label}
          {props.required && <span className="text-[#FF3131] ml-1">*</span>}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3.5 py-3 border bg-white text-black placeholder:text-black/35 rounded-none
            transition-colors duration-150
            focus:border-black focus:ring-1 focus:ring-black focus:outline-none
            hover:border-black/35
            disabled:bg-black/5 disabled:text-black/50 disabled:cursor-not-allowed disabled:border-black/10
            ${error ? 'border-[#FF3131] ring-1 ring-[#FF3131]' : 'border-black/15'}
            ${className}
          `}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-[#FF3131] font-medium">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="mt-1.5 text-xs text-black/50">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
