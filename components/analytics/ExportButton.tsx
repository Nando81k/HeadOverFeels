/**
 * ExportButton Component
 * 
 * Export analytics data in various formats
 * - CSV export
 * - JSON export
 * - Dropdown menu
 */

'use client';

import { useState } from 'react';
import { Download, FileText, FileJson, ChevronDown } from 'lucide-react';

interface ExportButtonProps {
  data: Record<string, unknown>;
  filename?: string;
  onExport?: (format: 'csv' | 'json') => void;
  className?: string;
}

export default function ExportButton({
  data,
  filename = 'analytics-export',
  onExport,
  className = ''
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Convert data to CSV
  const convertToCSV = (obj: Record<string, unknown>): string => {
    const lines: string[] = [];
    
    // Helper to flatten nested objects
    const flatten = (data: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(data)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (Array.isArray(value)) {
          // For arrays, create separate rows
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              Object.assign(result, flatten(item as Record<string, unknown>, `${newKey}[${index}]`));
            } else {
              result[`${newKey}[${index}]`] = item;
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          Object.assign(result, flatten(value as Record<string, unknown>, newKey));
        } else {
          result[newKey] = value;
        }
      }
      
      return result;
    };

    const flattened = flatten(obj);
    
    // Headers
    lines.push(Object.keys(flattened).join(','));
    
    // Values
    lines.push(Object.values(flattened).map(v => 
      typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v)
    ).join(','));
    
    return lines.join('\n');
  };

  // Download file
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle CSV export
  const handleCSVExport = async () => {
    setIsExporting(true);
    setIsOpen(false);

    try {
      const csv = convertToCSV(data);
      downloadFile(csv, `${filename}.csv`, 'text/csv');
      
      if (onExport) {
        onExport('csv');
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle JSON export
  const handleJSONExport = async () => {
    setIsExporting(true);
    setIsOpen(false);

    try {
      const json = JSON.stringify(data, null, 2);
      downloadFile(json, `${filename}.json`, 'application/json');
      
      if (onExport) {
        onExport('json');
      }
    } catch (error) {
      console.error('Error exporting JSON:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        <span>{isExporting ? 'Exporting...' : 'Export'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && !isExporting && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              <button
                onClick={handleCSVExport}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-4 h-4 text-gray-400" />
                <span>Export as CSV</span>
              </button>
              <button
                onClick={handleJSONExport}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FileJson className="w-4 h-4 text-gray-400" />
                <span>Export as JSON</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
