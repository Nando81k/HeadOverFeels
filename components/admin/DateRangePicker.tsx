'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  onRangeChange: (startDate: Date, endDate: Date) => void;
  disabled?: boolean;
}

export default function DateRangePicker({ onRangeChange, disabled = false }: DateRangePickerProps) {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const handleApply = () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      alert('Start date must be before end date');
      return;
    }

    // Set time to start/end of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    onRangeChange(start, end);
  };

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="flex items-center gap-3 bg-white p-4 rounded-lg border border-gray-200">
      <Calendar className="w-5 h-5 text-gray-500" />
      
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <label htmlFor="start-date" className="text-xs text-gray-600 mb-1">
            From
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={disabled}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        <span className="text-gray-400 mt-5">—</span>

        <div className="flex flex-col">
          <label htmlFor="end-date" className="text-xs text-gray-600 mb-1">
            To
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={disabled}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="flex gap-2 ml-2">
        <button
          onClick={handleApply}
          disabled={disabled || !startDate || !endDate}
          className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Apply
        </button>
        <button
          onClick={handleClear}
          disabled={disabled || (!startDate && !endDate)}
          className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
