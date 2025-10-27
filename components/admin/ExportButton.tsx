'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { generateDashboardCSV, downloadCSV, generateFilename, saveExportToHistory } from '@/lib/export-utils';

interface ExportButtonProps {
  period: string;
  stats: {
    orders: number;
    revenue: number;
    products: number;
    customers: number;
  };
  orders: Array<{
    id: string;
    orderNumber: string;
    customer: { name: string | null; email: string } | null;
    createdAt: Date;
    status: string;
    total: number;
  }>;
  customRange?: { start: Date; end: Date };
  onExportComplete?: () => void;
}

export default function ExportButton({ 
  period, 
  stats, 
  orders, 
  customRange,
  onExportComplete 
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // Prepare data for CSV
      const exportData = {
        orders: orders.map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customer: order.customer ? `${order.customer.name || 'Guest'} (${order.customer.email})` : 'Guest',
          date: order.createdAt.toLocaleString(),
          status: order.status,
          total: order.total,
        })),
        summary: {
          period: period.charAt(0).toUpperCase() + period.slice(1),
          totalOrders: stats.orders,
          totalRevenue: stats.revenue,
          activeProducts: stats.products,
          totalCustomers: stats.customers,
          dateRange: customRange 
            ? `${customRange.start.toLocaleDateString()} - ${customRange.end.toLocaleDateString()}`
            : undefined,
        },
      };

      // Generate CSV content
      const csvContent = generateDashboardCSV(exportData);
      
      // Generate filename
      const filename = generateFilename(period, customRange);
      
      // Download the file
      downloadCSV(csvContent, filename);
      
      // Save to history
      saveExportToHistory({
        filename,
        period: exportData.summary.period,
        orderCount: stats.orders,
        revenue: stats.revenue,
      });
      
      // Notify parent
      if (onExportComplete) {
        onExportComplete();
      }
      
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
    >
      <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
      {isExporting ? 'Exporting...' : 'Export to CSV'}
    </button>
  );
}
