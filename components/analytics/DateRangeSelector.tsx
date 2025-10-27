/**
 * DateRangeSelector Component
 * 
 * Date range picker with preset options
 * - Quick presets (7d, 30d, 90d)
 * - Custom date range
 * - Apply/Cancel actions
 */

'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';

export interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePreset {
  label: string;
  value: string;
  getDates: () => DateRange;
}

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: DateRangePreset[];
}

// Default presets
const DEFAULT_PRESETS: DateRangePreset[] = [
  {
    label: 'Last 7 Days',
    value: '7d',
    getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return { start, end };
    }
  },
  {
    label: 'Last 30 Days',
    value: '30d',
    getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return { start, end };
    }
  },
  {
    label: 'Last 90 Days',
    value: '90d',
    getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 90);
      return { start, end };
    }
  },
  {
    label: 'This Month',
    value: 'month',
    getDates: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
  },
  {
    label: 'Last Month',
    value: 'last-month',
    getDates: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start, end };
    }
  },
  {
    label: 'This Year',
    value: 'year',
    getDates: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start, end };
    }
  }
];

export default function DateRangeSelector({
  value,
  onChange,
  presets = DEFAULT_PRESETS
}: DateRangeSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [tempStart, setTempStart] = useState(value.start.toISOString().split('T')[0]);
  const [tempEnd, setTempEnd] = useState(value.end.toISOString().split('T')[0]);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Handle preset selection
  const handlePreset = (preset: DateRangePreset) => {
    const range = preset.getDates();
    onChange(range);
    setActivePreset(preset.value);
    setShowCustom(false);
  };

  // Handle custom range apply
  const handleApplyCustom = () => {
    const start = new Date(tempStart);
    const end = new Date(tempEnd);
    
    if (start <= end) {
      onChange({ start, end });
      setActivePreset(null);
      setShowCustom(false);
    }
  };

  // Handle custom range cancel
  const handleCancelCustom = () => {
    setTempStart(value.start.toISOString().split('T')[0]);
    setTempEnd(value.end.toISOString().split('T')[0]);
    setShowCustom(false);
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      {/* Current Selection Display */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Calendar className="w-4 h-4" />
        <span className="font-medium">
          {formatDate(value.start)} - {formatDate(value.end)}
        </span>
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePreset(preset)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activePreset === preset.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showCustom || (!activePreset && !showCustom)
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Custom Range
        </button>
      </div>

      {/* Custom Date Range Picker */}
      {showCustom && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={tempStart}
                onChange={(e) => setTempStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={tempEnd}
                onChange={(e) => setTempEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancelCustom}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyCustom}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
