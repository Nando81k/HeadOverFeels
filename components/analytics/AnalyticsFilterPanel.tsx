/**
 * AnalyticsFilterPanel Component
 * 
 * Advanced filtering controls for analytics dashboard:
 * - Period comparison toggle
 * - Granularity selector (daily/weekly/monthly)
 * - Category filter for revenue
 * - Status filter for orders
 * - Collapsible panel
 */

'use client';

import { useState } from 'react';
import { Funnel, CaretDown, CaretUp, Check } from '@phosphor-icons/react';

export interface AnalyticsFilters {
  compareWithPrevious: boolean;
  granularity: 'daily' | 'weekly' | 'monthly';
  categories: string[];
  orderStatuses: string[];
}

interface AnalyticsFilterPanelProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: AnalyticsFilters) => void;
  availableCategories?: string[];
  availableStatuses?: string[];
}

const DEFAULT_CATEGORIES = [
  'Hoodies',
  'T-Shirts',
  'Accessories',
  'Jackets',
  'Pants',
  'Shoes'
];

const DEFAULT_STATUSES = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
];

export default function AnalyticsFilterPanel({
  filters,
  onFiltersChange,
  availableCategories = DEFAULT_CATEGORIES,
  availableStatuses = DEFAULT_STATUSES
}: AnalyticsFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Toggle comparison
  const toggleComparison = () => {
    onFiltersChange({
      ...filters,
      compareWithPrevious: !filters.compareWithPrevious
    });
  };

  // Change granularity
  const setGranularity = (granularity: 'daily' | 'weekly' | 'monthly') => {
    onFiltersChange({
      ...filters,
      granularity
    });
  };

  // Toggle category
  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    
    onFiltersChange({
      ...filters,
      categories: newCategories
    });
  };

  // Toggle status
  const toggleStatus = (status: string) => {
    const newStatuses = filters.orderStatuses.includes(status)
      ? filters.orderStatuses.filter(s => s !== status)
      : [...filters.orderStatuses, status];
    
    onFiltersChange({
      ...filters,
      orderStatuses: newStatuses
    });
  };

  // Select all categories
  const selectAllCategories = () => {
    onFiltersChange({
      ...filters,
      categories: availableCategories
    });
  };

  // Clear all categories
  const clearAllCategories = () => {
    onFiltersChange({
      ...filters,
      categories: []
    });
  };

  // Select all statuses
  const selectAllStatuses = () => {
    onFiltersChange({
      ...filters,
      orderStatuses: availableStatuses
    });
  };

  // Clear all statuses
  const clearAllStatuses = () => {
    onFiltersChange({
      ...filters,
      orderStatuses: []
    });
  };

  return (
    <div className="bg-neutral-900 border border-white/10">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Funnel size={20} weight="bold" className="text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Filters & Options</h3>
          {(filters.compareWithPrevious || 
            filters.categories.length < availableCategories.length ||
            filters.orderStatuses.length < availableStatuses.length) && (
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium">
              Active
            </span>
          )}
        </div>
        {isExpanded ? (
          <CaretUp size={20} weight="bold" className="text-white/40" />
        ) : (
          <CaretDown size={20} weight="bold" className="text-white/40" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-white/10 p-6 space-y-6">
          {/* Comparison Toggle */}
          <div>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-white">
                  Compare with Previous Period
                </span>
                <p className="text-xs text-white/40 mt-1">
                  Show growth indicators compared to the previous time period
                </p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={filters.compareWithPrevious}
                  onChange={toggleComparison}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-purple-600 peer-focus:ring-2 peer-focus:ring-purple-500/50 transition-colors">
                  <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform ${
                    filters.compareWithPrevious ? 'translate-x-5' : ''
                  }`} />
                </div>
              </div>
            </label>
          </div>

          {/* Granularity Selector */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-3">
              Data Granularity
            </label>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setGranularity(option)}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    filters.granularity === option
                      ? 'bg-purple-600 text-white border border-purple-500'
                      : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] uppercase tracking-[0.15em] text-white/40">
                Product Categories
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAllCategories}
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium"
                >
                  Select All
                </button>
                <span className="text-white/20">|</span>
                <button
                  onClick={clearAllCategories}
                  className="text-xs text-white/50 hover:text-white/70 font-medium"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                    filters.categories.includes(category)
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-4 h-4 border flex items-center justify-center ${
                    filters.categories.includes(category)
                      ? 'bg-purple-600 border-purple-600'
                      : 'border-white/30'
                  }`}>
                    {filters.categories.includes(category) && (
                      <Check size={12} weight="bold" className="text-white" />
                    )}
                  </div>
                  <span>{category}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-white/30 mt-2">
              {filters.categories.length} of {availableCategories.length} categories selected
            </p>
          </div>

          {/* Order Status Filter */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] uppercase tracking-[0.15em] text-white/40">
                Order Statuses
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAllStatuses}
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium"
                >
                  Select All
                </button>
                <span className="text-white/20">|</span>
                <button
                  onClick={clearAllStatuses}
                  className="text-xs text-white/50 hover:text-white/70 font-medium"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    filters.orderStatuses.includes(status)
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-4 h-4 border flex items-center justify-center ${
                    filters.orderStatuses.includes(status)
                      ? 'bg-emerald-600 border-emerald-600'
                      : 'border-white/30'
                  }`}>
                    {filters.orderStatuses.includes(status) && (
                      <Check size={12} weight="bold" className="text-white" />
                    )}
                  </div>
                  <span>{status}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-white/30 mt-2">
              {filters.orderStatuses.length} of {availableStatuses.length} statuses selected
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
