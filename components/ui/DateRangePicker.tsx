'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, X } from '@phosphor-icons/react'
import { DateRange, DayPicker } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import 'react-day-picker/dist/style.css'

interface DateRangePickerProps {
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  placeholder?: string
}

export function DateRangePicker({ 
  dateRange, 
  onDateRangeChange,
  placeholder = 'Pick a date range' 
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleClear = () => {
    onDateRangeChange(undefined)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-start text-left font-normal"
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {dateRange?.from ? (
          dateRange.to ? (
            <>
              {format(dateRange.from, 'LLL dd, y')} -{' '}
              {format(dateRange.to, 'LLL dd, y')}
            </>
          ) : (
            format(dateRange.from, 'LLL dd, y')
          )
        ) : (
          <span>{placeholder}</span>
        )}
        {dateRange?.from && (
          <X
            className="ml-auto h-4 w-4"
            onClick={(e) => {
              e.stopPropagation()
              handleClear()
            }}
          />
        )}
      </Button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
            <DayPicker
              mode="range"
              selected={dateRange}
              onSelect={onDateRangeChange}
              numberOfMonths={2}
              className="rdp-custom"
            />
            <div className="flex justify-end gap-2 mt-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                className="bg-[#FF3131] hover:bg-[#E02828]"
              >
                Apply
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
