// CSV Export Utilities for Dashboard Data

interface ExportData {
  orders: Array<{
    id: string;
    orderNumber: string;
    customer: string;
    date: string;
    status: string;
    total: number;
  }>;
  summary: {
    period: string;
    totalOrders: number;
    totalRevenue: number;
    activeProducts: number;
    totalCustomers: number;
    dateRange?: string;
  };
}

export function generateDashboardCSV(data: ExportData): string {
  const { orders, summary } = data;
  
  // CSV Header
  let csv = 'Head Over Feels - Dashboard Export\n';
  csv += `Generated: ${new Date().toLocaleString()}\n`;
  csv += `Period: ${summary.period}${summary.dateRange ? ` (${summary.dateRange})` : ''}\n`;
  csv += '\n';
  
  // Summary Section
  csv += 'SUMMARY\n';
  csv += 'Metric,Value\n';
  csv += `Total Orders,${summary.totalOrders}\n`;
  csv += `Total Revenue,$${summary.totalRevenue.toFixed(2)}\n`;
  csv += `Active Products,${summary.activeProducts}\n`;
  csv += `Total Customers,${summary.totalCustomers}\n`;
  csv += '\n';
  
  // Orders Section
  csv += 'ORDERS\n';
  csv += 'Order Number,Customer,Date,Status,Total\n';
  
  orders.forEach(order => {
    csv += `${order.orderNumber},"${order.customer}",${order.date},${order.status},$${order.total.toFixed(2)}\n`;
  });
  
  return csv;
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    // Feature detection
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export function generateFilename(period: string, customRange?: { start: Date; end: Date }): string {
  const timestamp = new Date().toISOString().split('T')[0];
  
  if (customRange) {
    const startDate = customRange.start.toISOString().split('T')[0];
    const endDate = customRange.end.toISOString().split('T')[0];
    return `dashboard-export-${startDate}-to-${endDate}.csv`;
  }
  
  return `dashboard-export-${period}-${timestamp}.csv`;
}

export interface ExportHistoryItem {
  id: string;
  filename: string;
  timestamp: string;
  period: string;
  orderCount: number;
  revenue: number;
}

export function saveExportToHistory(item: Omit<ExportHistoryItem, 'id' | 'timestamp'>): void {
  const history = getExportHistory();
  const newItem: ExportHistoryItem = {
    ...item,
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
  };
  
  history.unshift(newItem);
  
  // Keep only last 10 exports
  const trimmedHistory = history.slice(0, 10);
  localStorage.setItem('dashboard-export-history', JSON.stringify(trimmedHistory));
}

export function getExportHistory(): ExportHistoryItem[] {
  try {
    const stored = localStorage.getItem('dashboard-export-history');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function clearExportHistory(): void {
  localStorage.removeItem('dashboard-export-history');
}
