'use client'

import { useRef, useEffect } from 'react'
import { MagnifyingGlass, X, CircleNotch } from '@phosphor-icons/react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isLoading?: boolean
  placeholder?: string
  autoFocus?: boolean
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = 'What are you looking for?',
  autoFocus = true,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Small delay to ensure modal animation has started
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [autoFocus])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit()
    }
  }

  const handleClear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Search Icon */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 text-black/40">
        {isLoading ? (
          <CircleNotch size={24} className="animate-spin" />
        ) : (
          <MagnifyingGlass size={24} weight="light" />
        )}
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-transparent text-2xl md:text-3xl font-light text-black placeholder:text-black/30 border-none outline-none pl-10 pr-10 py-3 border-b-2 border-black/10 focus:border-black/30 transition-colors"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {/* Clear Button */}
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-black/40 hover:text-black transition-colors"
          aria-label="Clear search"
        >
          <X size={24} weight="light" />
        </button>
      )}

      {/* Bottom border accent */}
      <div 
        className="absolute bottom-0 left-0 h-0.5 bg-black transition-all duration-300"
        style={{ width: value ? '100%' : '0%' }}
      />
    </div>
  )
}
