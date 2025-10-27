'use client';

import { useState, useEffect } from 'react';
import { FileDown, Trash2 } from 'lucide-react';
import { getExportHistory, clearExportHistory, type ExportHistoryItem } from '@/lib/export-utils';

export default function ExportHistory() {
  const [history, setHistory] = useState<ExportHistoryItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Load history after component mounts to avoid hydration mismatch
  useEffect(() => {
    // This setState is intentional - we need to wait for client-side mount
    // to access localStorage and avoid hydration mismatch
    setIsMounted(true);
    setHistory(getExportHistory());
  }, []);

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear all export history?')) {
      clearExportHistory();
      setHistory([]);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!isMounted || history.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileDown className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Export History</h3>
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
            {history.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {isExpanded ? 'Hide' : 'Show All'}
          </button>
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {(isExpanded ? history : history.slice(0, 3)).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900">{item.filename}</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                  {item.period}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <span>{formatDate(item.timestamp)}</span>
                <span>•</span>
                <span>{item.orderCount} orders</span>
                <span>•</span>
                <span>{formatCurrency(item.revenue)} revenue</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isExpanded && history.length > 3 && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full mt-3 text-sm text-gray-600 hover:text-gray-900 text-center"
        >
          + {history.length - 3} more exports
        </button>
      )}
    </div>
  );
}
