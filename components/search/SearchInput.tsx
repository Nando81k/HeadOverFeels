'use client'

import { useRef, useEffect, useMemo, useState } from 'react'
import { MagnifyingGlass, X, CircleNotch } from '@phosphor-icons/react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onSuggestionSelect?: (suggestion: string) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
  inputTestId?: string
  suggestionsTestId?: string
  isLoading?: boolean
  placeholder?: string
  autoFocus?: boolean
  suggestions?: string[]
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  onSuggestionSelect,
  onKeyDown,
  inputTestId,
  suggestionsTestId = 'search-input-suggestions',
  isLoading = false,
  placeholder = 'What are you looking for?',
  autoFocus = true,
  suggestions = [],
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  const normalizedQuery = value.trim().toLowerCase()
  const filteredSuggestions = useMemo(() => {
    if (normalizedQuery.length < 2) {
      return []
    }

    const seen = new Set<string>()
    const nextSuggestions: string[] = []

    suggestions.forEach((suggestion) => {
      const trimmed = suggestion.trim()
      if (!trimmed) {
        return
      }

      const normalizedSuggestion = trimmed.toLowerCase()
      if (seen.has(normalizedSuggestion) || !normalizedSuggestion.includes(normalizedQuery)) {
        return
      }

      seen.add(normalizedSuggestion)
      nextSuggestions.push(trimmed)
    })

    return nextSuggestions.slice(0, 8)
  }, [normalizedQuery, suggestions])

  const showSuggestions = isFocused && filteredSuggestions.length > 0

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Small delay to ensure modal animation has started
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [autoFocus])

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e)
    if (e.defaultPrevented) {
      return
    }
    if (e.key === 'Enter' && value.trim()) {
      onSubmit()
    }
  }

  const handleClear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
    setIsFocused(true)
  }

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      setIsFocused(false)
      blurTimeoutRef.current = null
    }, 100)
  }

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion)
    onSuggestionSelect?.(suggestion)
    setIsFocused(false)
  }

  const renderHighlightedSuggestion = (suggestion: string) => {
    if (!normalizedQuery) {
      return suggestion
    }

    const start = suggestion.toLowerCase().indexOf(normalizedQuery)
    if (start < 0) {
      return suggestion
    }

    const end = start + normalizedQuery.length
    return (
      <>
        <span>{suggestion.slice(0, start)}</span>
        <span className="font-black text-black">{suggestion.slice(start, end)}</span>
        <span>{suggestion.slice(end)}</span>
      </>
    )
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
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        data-testid={inputTestId}
        className="w-full bg-transparent text-2xl md:text-3xl font-light text-black placeholder:text-black/30 border-none outline-none pl-10 pr-10 py-3 border-b-2 border-black/10 focus:border-black/30 transition-colors"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {showSuggestions ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_14px_32px_rgba(0,0,0,0.08)]"
          data-testid={suggestionsTestId}
        >
          <div className="border-b border-black/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-black/45">
            Suggestions
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSuggestionClick(suggestion)}
                className="flex w-full items-center justify-between border-b border-black/5 px-4 py-3 text-left text-sm text-black/75 transition-colors hover:bg-black/[0.03] hover:text-black last:border-b-0"
              >
                <span className="truncate">{renderHighlightedSuggestion(suggestion)}</span>
                <span className="ml-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/35">
                  Product
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

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
