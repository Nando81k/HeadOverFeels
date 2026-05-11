'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MagnifyingGlass, MapPin, X, CircleNotch } from '@phosphor-icons/react'

interface AddressSuggestion {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
}

interface AddressComponents {
  address: string
  city: string
  state: string
  zipCode: string
  country: string
}

interface AddressAutocompleteProps {
  label: string
  value: string
  onChange: (value: string) => void
  onAddressSelect: (components: AddressComponents) => void
  error?: string
  placeholder?: string
  required?: boolean
}

export function AddressAutocomplete({
  label,
  value,
  onChange,
  onAddressSelect,
  error,
  placeholder = 'Start typing your address...',
  required,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [apiAvailable, setApiAvailable] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch address suggestions
  const fetchSuggestions = useCallback(async (input: string) => {
    if (!input || input.length < 3 || !apiAvailable) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`)
      if (response.ok) {
        const data = await response.json()
        if (data.predictions && data.predictions.length > 0) {
          setSuggestions(data.predictions)
          setIsOpen(true)
        } else if (data.error || data.status === 'REQUEST_DENIED') {
          // API not available, disable it
          setApiAvailable(false)
          setSuggestions([])
        } else {
          setSuggestions([])
        }
      } else {
        setApiAvailable(false)
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error)
      setApiAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [apiAvailable])

  // Debounced input handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    setSelectedIndex(-1)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue)
    }, 300)
  }

  // Handle place selection
  const handleSelectPlace = async (suggestion: AddressSuggestion) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/places/details?placeId=${suggestion.placeId}`)
      if (response.ok) {
        const data = await response.json()
        onChange(data.address || suggestion.mainText)
        onAddressSelect({
          address: data.address || suggestion.mainText,
          city: data.city || '',
          state: data.state || '',
          zipCode: data.zipCode || '',
          country: data.country || 'United States',
        })
      }
    } catch (error) {
      console.error('Error fetching place details:', error)
      onChange(suggestion.mainText)
    } finally {
      setLoading(false)
      setIsOpen(false)
      setSuggestions([])
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelectPlace(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <div ref={containerRef} className="relative w-full">
      <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-black/65 mb-2">
        {label}
        {required && <span className="text-[#FF3131] ml-1">*</span>}
      </label>

      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40">
          {loading ? (
            <CircleNotch size={16} className="animate-spin" />
          ) : (
            <MagnifyingGlass size={16} />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          autoComplete={apiAvailable ? "off" : "street-address"}
          name="street-address"
          className={`
            w-full pl-10 pr-10 py-3 border bg-white text-black placeholder:text-black/35 rounded-none
            transition-colors duration-150
            focus:border-black focus:ring-1 focus:ring-black focus:outline-none
            hover:border-black/35
            ${error ? 'border-[#FF3131] ring-1 ring-[#FF3131]' : 'border-black/15'}
          `}
        />

        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              setSuggestions([])
              setIsOpen(false)
              inputRef.current?.focus()
            }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/40 hover:text-black transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-black/15 shadow-md max-h-64 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.placeId}
              type="button"
              onClick={() => handleSelectPlace(suggestion)}
              className={`w-full px-4 py-3 text-left flex items-start gap-3 transition-colors border-b border-black/5 last:border-b-0 ${
                index === selectedIndex
                  ? 'bg-black text-white'
                  : 'hover:bg-black/5'
              }`}
            >
              <MapPin
                size={16}
                weight="fill"
                className={`shrink-0 mt-0.5 ${index === selectedIndex ? 'text-white' : 'text-black/40'}`}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${index === selectedIndex ? 'text-white' : 'text-black'}`}>
                  {suggestion.mainText}
                </p>
                <p className={`text-xs truncate ${index === selectedIndex ? 'text-white/70' : 'text-black/50'}`}>
                  {suggestion.secondaryText}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-[#FF3131] font-medium">{error}</p>
      )}
    </div>
  )
}
