"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CaretDown,
  Check,
  CalendarBlank,
} from "@phosphor-icons/react";

export type DateRange = {
  startDate: Date;
  endDate: Date;
  label: string;
};

type PresetOption = {
  label: string;
  getValue: () => { startDate: Date; endDate: Date };
};

interface GlobalDateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const presetOptions: PresetOption[] = [
  {
    label: "Last 7 days",
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return { startDate: start, endDate: end };
    },
  },
  {
    label: "Last 30 days",
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return { startDate: start, endDate: end };
    },
  },
  {
    label: "Last 90 days",
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 90);
      return { startDate: start, endDate: end };
    },
  },
  {
    label: "This month",
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      return { startDate: start, endDate: end };
    },
  },
  {
    label: "Last month",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: start, endDate: end };
    },
  },
  {
    label: "This quarter",
    getValue: () => {
      const end = new Date();
      const quarterStart = Math.floor(end.getMonth() / 3) * 3;
      const start = new Date(end.getFullYear(), quarterStart, 1);
      return { startDate: start, endDate: end };
    },
  },
  {
    label: "This year",
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), 0, 1);
      return { startDate: start, endDate: end };
    },
  },
  {
    label: "Last year",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, 11, 31);
      return { startDate: start, endDate: end };
    },
  },
  {
    label: "All time",
    getValue: () => {
      const end = new Date();
      const start = new Date("2020-01-01");
      return { startDate: start, endDate: end };
    },
  },
];

export default function GlobalDateRangePicker({
  value,
  onChange,
  className = "",
}: GlobalDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customStart, setCustomStart] = useState<string>(
    value.startDate.toISOString().split("T")[0]
  );
  const [customEnd, setCustomEnd] = useState<string>(
    value.endDate.toISOString().split("T")[0]
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setCustomMode(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePresetSelect = (preset: PresetOption) => {
    const { startDate, endDate } = preset.getValue();
    onChange({ startDate, endDate, label: preset.label });
    setIsOpen(false);
    setCustomMode(false);
  };

  const handleCustomApply = () => {
    const startDate = new Date(customStart);
    const endDate = new Date(customEnd);
    if (startDate <= endDate) {
      onChange({
        startDate,
        endDate,
        label: `${formatDate(startDate)} - ${formatDate(endDate)}`,
      });
      setIsOpen(false);
      setCustomMode(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDisplayDate = () => {
    if (value.label) return value.label;
    return `${formatDate(value.startDate)} - ${formatDate(value.endDate)}`;
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all group"
      >
        <Calendar size={18} weight="bold" className="text-fuchsia-400" />
        <span className="text-sm font-medium">{formatDisplayDate()}</span>
        <CaretDown
          size={14}
          weight="bold"
          className={`text-white/50 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 min-w-[280px] bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          >
            {!customMode ? (
              <>
                {/* Presets */}
                <div className="p-2">
                  <p className="px-3 py-1.5 text-xs font-medium text-white/40 uppercase tracking-wider">
                    Quick Select
                  </p>
                  {presetOptions.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => handlePresetSelect(preset)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        value.label === preset.label
                          ? "bg-fuchsia-500/20 text-fuchsia-400"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>{preset.label}</span>
                      {value.label === preset.label && (
                        <Check size={16} weight="bold" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom Range Button */}
                <div className="border-t border-white/10 p-2">
                  <button
                    onClick={() => setCustomMode(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <CalendarBlank size={16} weight="bold" />
                    Custom range...
                  </button>
                </div>
              </>
            ) : (
              /* Custom Date Inputs */
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm text-white/50 mb-2">
                  <CalendarBlank size={16} weight="bold" />
                  Custom Date Range
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      max={customEnd}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-fuchsia-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      min={customStart}
                      max={new Date().toISOString().split("T")[0]}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-fuchsia-500/50"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setCustomMode(false)}
                    className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCustomApply}
                    className="flex-1 px-3 py-2 bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-500/30 rounded-lg text-sm text-fuchsia-400 hover:text-fuchsia-300 transition-colors font-medium"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Default date range (Last 30 days)
export function getDefaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { startDate: start, endDate: end, label: "Last 30 days" };
}
