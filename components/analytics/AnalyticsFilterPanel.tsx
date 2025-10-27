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
import { Filter, ChevronDown, ChevronUp, Check } from 'lucide-react';

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
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters & Options</h3>
          {(filters.compareWithPrevious || 
            filters.categories.length < availableCategories.length ||
            filters.orderStatuses.length < availableStatuses.length) && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              Active
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-6 space-y-6">
          {/* Comparison Toggle */}
          <div>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-900">
                  Compare with Previous Period
                </span>
                <p className="text-xs text-gray-500 mt-1">
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
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-focus:ring-4 peer-focus:ring-blue-300 transition-colors">
                  <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform ${
                    filters.compareWithPrevious ? 'translate-x-5' : ''
                  }`} />
                </div>
              </div>
            </label>
          </div>

          {/* Granularity Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Data Granularity
            </label>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setGranularity(option)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filters.granularity === option
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
              <label className="text-sm font-medium text-gray-900">
                Product Categories
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAllCategories}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={clearAllCategories}
                  className="text-xs text-gray-600 hover:text-gray-700 font-medium"
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
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filters.categories.includes(category)
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    filters.categories.includes(category)
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300'
                  }`}>
                    {filters.categories.includes(category) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span>{category}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {filters.categories.length} of {availableCategories.length} categories selected
            </p>
          </div>

          {/* Order Status Filter */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-900">
                Order Statuses
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAllStatuses}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={clearAllStatuses}
                  className="text-xs text-gray-600 hover:text-gray-700 font-medium"
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
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                    filters.orderStatuses.includes(status)
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    filters.orderStatuses.includes(status)
                      ? 'bg-purple-600 border-purple-600'
                      : 'border-gray-300'
                  }`}>
                    {filters.orderStatuses.includes(status) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span>{status}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {filters.orderStatuses.length} of {availableStatuses.length} statuses selected
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
