'use client'

import { useState, useEffect, useRef } from 'react'

interface InlineEditProps {
  value: string | number
  onSave: (value: string) => Promise<void>
  type?: 'text' | 'number'
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  className?: string
}

export function InlineEdit({
  value,
  onSave,
  type = 'text',
  prefix = '',
  suffix = '',
  min,
  max,
  className = '',
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(value))
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = () => {
    setEditValue(String(value))
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (editValue === String(value)) {
      setIsEditing(false)
      return
    }

    // Validation
    if (type === 'number') {
      const numValue = parseFloat(editValue)
      if (isNaN(numValue)) {
        setEditValue(String(value))
        setIsEditing(false)
        return
      }
      if (min !== undefined && numValue < min) {
        setEditValue(String(value))
        setIsEditing(false)
        return
      }
      if (max !== undefined && numValue > max) {
        setEditValue(String(value))
        setIsEditing(false)
        return
      }
    }

    setIsSaving(true)
    try {
      await onSave(editValue)
      setIsEditing(false)
    } catch (error) {
      // Revert on error
      setEditValue(String(value))
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setEditValue(String(value))
      setIsEditing(false)
    }
  }

  const handleBlur = () => {
    if (!isSaving) {
      handleSave()
    }
  }

  if (isEditing) {
    return (
      <div className="relative inline-block">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">{prefix}</span>}
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isSaving}
          min={min}
          max={max}
          className={`border border-blue-500 rounded px-2 py-1 ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-12' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${className}`}
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">{suffix}</span>}
        {isSaving && (
          <div className="absolute -right-6 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`cursor-pointer hover:bg-gray-100 rounded px-2 py-1 transition-colors ${className}`}
      title="Double-click to edit"
    >
      {prefix}{value}{suffix}
    </div>
  )
}
