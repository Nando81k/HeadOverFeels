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
import { Calendar } from '@phosphor-icons/react';

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
      <div className="flex items-center gap-2 text-sm text-white/60">
        <Calendar size={16} weight="bold" />
        <span className="font-medium text-white">
          {formatDate(value.start)} - {formatDate(value.end)}
        </span>
      </div>

      {/* Preset Buttons - dark theme */}
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePreset(preset)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activePreset === preset.value
                ? 'bg-purple-600 text-white border border-purple-500'
                : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            showCustom || (!activePreset && !showCustom)
              ? 'bg-purple-600 text-white border border-purple-500'
              : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:border-white/20'
          }`}
        >
          Custom Range
        </button>
      </div>

      {/* Custom Date Range Picker - dark theme */}
      {showCustom && (
        <div className="bg-white/5 border border-white/10 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={tempStart}
                onChange={(e) => setTempStart(e.target.value)}
                className="w-full px-3 py-2 bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={tempEnd}
                onChange={(e) => setTempEnd(e.target.value)}
                className="w-full px-3 py-2 bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancelCustom}
              className="px-4 py-2 text-sm font-medium text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyCustom}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
