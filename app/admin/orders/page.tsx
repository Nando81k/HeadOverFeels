'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { OrderMobileCard } from '@/components/admin/OrderMobileCard';
import { toast } from '@/lib/toast';
import { ShoppingCart, Download, Funnel, X, SpeakerHigh, SpeakerSlash, ArrowsClockwise, CaretUp, CaretDown, CheckSquare, Square, MagnifyingGlass, CurrencyDollar } from '@phosphor-icons/react';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { isWithinInterval } from 'date-fns';
import { useOrderPolling } from '@/lib/hooks/useOrderPolling';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  customer: {
    email: string;
    phone?: string;
  };
  shippingAddress?: {
    firstName: string;
    lastName: string;
  };
  _count?: {
    items: number;
  };
}

interface OrdersResponse {
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // Input field value
  const [appliedSearchQuery, setAppliedSearchQuery] = useState(''); // Actually applied to API
  
  // Advanced filters
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showFilters, setShowFilters] = useState(true); // Default to showing filters

  // Sorting state
  const [sortField, setSortField] = useState<'createdAt' | 'total' | 'status'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Bulk selection state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Real-time polling
  const { 
    newOrderCount, 
    isMuted, 
    toggleMute, 
    clearNewOrderCount,
    isPolling,
    lastChecked 
  } = useOrderPolling({
    pollingInterval: 30000, // 30 seconds
    enabled: true,
    onNewOrders: (count) => {
      toast.success(`${count} New Order${count > 1 ? 's' : ''}!`, 'Check the orders list for new orders');
    }
  });

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (statusFilter) params.append('status', statusFilter);
      if (appliedSearchQuery) params.append('search', appliedSearchQuery);

      const response = await fetch(`/api/orders?${params}`, {
        headers: {
          'x-user-admin': 'true', // Enable admin search capabilities
        },
      });
      const data: OrdersResponse = await response.json();

      if (data.data) {
        // Apply client-side filters
        let filteredOrders = data.data;
        
        // Date range filter
        if (dateRange?.from) {
          filteredOrders = filteredOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            if (dateRange.to) {
              return isWithinInterval(orderDate, { start: dateRange.from!, end: dateRange.to });
            }
            return orderDate >= dateRange.from!;
          });
        }
        
        // Multi-status filter
        if (selectedStatuses.length > 0) {
          filteredOrders = filteredOrders.filter(order => 
            selectedStatuses.includes(order.status)
          );
        }
        
        // Price range filter
        if (minAmount) {
          filteredOrders = filteredOrders.filter(order => 
            order.total >= parseFloat(minAmount)
          );
        }
        if (maxAmount) {
          filteredOrders = filteredOrders.filter(order => 
            order.total <= parseFloat(maxAmount)
          );
        }
        
        // Payment status filter (client-side)
        if (paymentStatusFilter) {
          filteredOrders = filteredOrders.filter(order => 
            order.paymentStatus === paymentStatusFilter
          );
        }

        // Apply client-side sorting
        filteredOrders = [...filteredOrders].sort((a, b) => {
          let comparison = 0;
          
          switch (sortField) {
            case 'createdAt':
              comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              break;
            case 'total':
              comparison = a.total - b.total;
              break;
            case 'status':
              comparison = a.status.localeCompare(b.status);
              break;
          }
          
          return sortDirection === 'asc' ? comparison : -comparison;
        });
        
        setOrders(filteredOrders);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, paymentStatusFilter, appliedSearchQuery, dateRange, selectedStatuses, minAmount, maxAmount, sortField, sortDirection]);

  // Handle refresh - clear new order count and refetch
  const handleRefresh = useCallback(() => {
    clearNewOrderCount();
    setSelectedOrders(new Set());
    fetchOrders();
  }, [clearNewOrderCount, fetchOrders]);

  // Handle sort column click
  const handleSort = (field: 'createdAt' | 'total' | 'status') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  const toggleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  // Bulk status update
  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedOrders.size === 0) return;
    
    setBulkUpdating(true);
    const loadingToast = toast.loading(`Updating ${selectedOrders.size} orders...`);
    
    try {
      const updatePromises = Array.from(selectedOrders).map(orderId =>
        fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
      );
      
      await Promise.all(updatePromises);
      
      toast.dismiss(loadingToast);
      toast.success('Orders updated', `${selectedOrders.size} orders set to ${newStatus}`);
      setSelectedOrders(new Set());
      fetchOrders();
    } catch {
      toast.dismiss(loadingToast);
      toast.error('Update failed', 'Some orders could not be updated');
    } finally {
      setBulkUpdating(false);
    }
  };

  // Inline status update for single order
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  
  const handleInlineStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId);
    
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!response.ok) throw new Error('Failed to update status');
      
      // Update local state optimistically
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      
      toast.success('Status updated', `Order status changed to ${newStatus}`);
    } catch {
      toast.error('Update failed', 'Could not update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearchQuery(searchQuery);
    setPage(1);
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-amber-500/20 text-amber-400',
      CONFIRMED: 'bg-blue-500/20 text-blue-400',
      PROCESSING: 'bg-purple-500/20 text-purple-400',
      SHIPPED: 'bg-indigo-500/20 text-indigo-400',
      DELIVERED: 'bg-emerald-500/20 text-emerald-400',
      CANCELLED: 'bg-red-500/20 text-red-400',
      REFUNDED: 'bg-white/10 text-white/70',
    };
    return colors[status] || 'bg-white/10 text-white/70';
  };

  const getPaymentStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-amber-500/20 text-amber-400',
      PAID: 'bg-emerald-500/20 text-emerald-400',
      FAILED: 'bg-red-500/20 text-red-400',
      REFUNDED: 'bg-white/10 text-white/70',
    };
    return colors[status] || 'bg-white/10 text-white/70';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleExportOrders = async () => {
    const loadingToast = toast.loading('Exporting orders...');
    
    try {
      // Simulate export (in real app, would call API)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create CSV content
      const csvContent = [
        ['Order Number', 'Customer', 'Email', 'Date', 'Total', 'Status', 'Payment'].join(','),
        ...orders.map(order => [
          order.orderNumber,
          order.shippingAddress ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}` : 'N/A',
          order.customer.email,
          formatDate(order.createdAt),
          order.total,
          order.status,
          order.paymentStatus
        ].join(','))
      ].join('\n');
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.dismiss(loadingToast);
      toast.success('Orders exported successfully', `Downloaded ${orders.length} orders`);
    } catch {
      toast.dismiss(loadingToast);
      toast.error('Export failed', 'Please try again');
    }
  };

  return (
    <AdminLayout
      title="Order Management"
      subtitle="View and manage customer orders"
      headerActions={
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Real-time status indicator - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white/5 border border-white/10">
            <div className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${isPolling ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider">Live</span>
            {lastChecked && (
              <span className="text-[10px] sm:text-xs text-white/30 hidden lg:inline">
                {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* New orders badge & refresh */}
          <button
            onClick={handleRefresh}
            className="relative inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-white/10 text-sm font-medium text-white bg-white/5 hover:bg-white/10 hover:border-white/20 transition-colors"
            title="Refresh orders"
          >
            <ArrowsClockwise size={14} weight="bold" className={`sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
            {newOrderCount > 0 && (
              <span className="absolute -top-1.5 sm:-top-2 -right-1.5 sm:-right-2 inline-flex items-center justify-center min-w-[16px] sm:min-w-[20px] h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs font-bold text-white bg-[#FF3131] rounded-full">
                {newOrderCount > 99 ? '99+' : newOrderCount}
              </span>
            )}
          </button>

          {/* Sound toggle */}
          <button
            onClick={toggleMute}
            className={`inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border text-sm font-medium transition-colors ${
              isMuted 
                ? 'border-white/10 text-white/40 bg-white/5 hover:bg-white/10' 
                : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
            }`}
            title={isMuted ? 'Unmute notifications' : 'Mute notifications'}
          >
            {isMuted ? <SpeakerSlash size={14} weight="bold" className="sm:w-4 sm:h-4" /> : <SpeakerHigh size={14} weight="bold" className="sm:w-4 sm:h-4" />}
          </button>

          {/* Export button - Hidden on small mobile */}
          <button
            onClick={handleExportOrders}
            disabled={orders.length === 0}
            className="hidden sm:inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-white/10 text-sm font-medium text-white bg-white/5 hover:bg-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none transition-colors"
          >
            <Download size={14} weight="bold" className="mr-1.5 sm:mr-2 sm:w-4 sm:h-4" />
            <span className="hidden lg:inline">Export</span>
          </button>
        </div>
      }
    >
      {/* Bulk Actions Toolbar */}
      {selectedOrders.size > 0 && (
        <div className="bg-[#FF3131]/10 border border-[#FF3131]/30 p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-white font-medium">
              {selectedOrders.size} order{selectedOrders.size > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedOrders(new Set())}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusUpdate(e.target.value);
                  e.target.value = '';
                }
              }}
              disabled={bulkUpdating}
              className="px-3 py-2 bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30 disabled:opacity-50"
              defaultValue=""
            >
              <option value="" disabled className="bg-neutral-900">Update Status...</option>
              <option value="PENDING" className="bg-neutral-900">Pending</option>
              <option value="CONFIRMED" className="bg-neutral-900">Confirmed</option>
              <option value="PROCESSING" className="bg-neutral-900">Processing</option>
              <option value="SHIPPED" className="bg-neutral-900">Shipped</option>
              <option value="DELIVERED" className="bg-neutral-900">Delivered</option>
              <option value="CANCELLED" className="bg-neutral-900">Cancelled</option>
            </select>
          </div>
        </div>
      )}

      {/* Search and Filters Panel */}
      <div className="bg-neutral-900 border border-white/10 mb-6">
        {/* Search Bar - Always visible */}
        <div className="p-4 border-b border-white/10">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <MagnifyingGlass size={18} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search by name, email, or order number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#FF3131] text-white font-medium hover:bg-[#E02828] transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 border transition-colors ${
                showFilters 
                  ? 'bg-white/10 border-white/20 text-white' 
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <Funnel size={18} weight={showFilters ? 'fill' : 'bold'} />
              Filters
              {(appliedSearchQuery || statusFilter || paymentStatusFilter || dateRange || selectedStatuses.length > 0 || minAmount || maxAmount) && (
                <span className="w-2 h-2 rounded-full bg-[#FF3131]" />
              )}
            </button>
          </form>
        </div>

        {/* Quick Filters - Always visible */}
        <div className="p-4 bg-white/[0.02] border-b border-white/10">
          <div className="flex flex-wrap gap-3">
            {/* Order Status */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5">
                Order Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#FF3131]/50 transition-colors"
              >
                <option value="" className="bg-neutral-900">All Statuses</option>
                <option value="PENDING" className="bg-neutral-900">Pending</option>
                <option value="CONFIRMED" className="bg-neutral-900">Confirmed</option>
                <option value="PROCESSING" className="bg-neutral-900">Processing</option>
                <option value="SHIPPED" className="bg-neutral-900">Shipped</option>
                <option value="DELIVERED" className="bg-neutral-900">Delivered</option>
                <option value="CANCELLED" className="bg-neutral-900">Cancelled</option>
                <option value="REFUNDED" className="bg-neutral-900">Refunded</option>
              </select>
            </div>

            {/* Payment Status */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5">
                Payment Status
              </label>
              <select
                value={paymentStatusFilter}
                onChange={(e) => {
                  setPaymentStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#FF3131]/50 transition-colors"
              >
                <option value="" className="bg-neutral-900">All Payments</option>
                <option value="PENDING" className="bg-neutral-900">Pending</option>
                <option value="PAID" className="bg-neutral-900">Paid</option>
                <option value="FAILED" className="bg-neutral-900">Failed</option>
                <option value="REFUNDED" className="bg-neutral-900">Refunded</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="flex-1 min-w-[220px]">
              <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1.5">
                Date Range
              </label>
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                placeholder="Select dates..."
              />
            </div>

            {/* Clear Quick Filters */}
            {(statusFilter || paymentStatusFilter || dateRange) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setStatusFilter('');
                    setPaymentStatusFilter('');
                    setDateRange(undefined);
                  }}
                  className="px-3 py-2 text-sm text-white/50 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Advanced Filters - Collapsible */}
        {showFilters && (
          <div className="p-4">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Multi-Status Select */}
              <div>
                <label className="flex items-center gap-2 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                  <CheckSquare size={14} weight="bold" />
                  Filter by Multiple Statuses
                </label>
                <div className="grid grid-cols-2 gap-2 p-3 border border-white/10 bg-white/[0.02]">
                  {['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].map(status => (
                    <label key={status} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(status)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStatuses([...selectedStatuses, status]);
                          } else {
                            setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                          }
                        }}
                        className="w-4 h-4 rounded border-white/30 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]/50"
                      />
                      <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="flex items-center gap-2 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                  <CurrencyDollar size={14} weight="bold" />
                  Order Total Range
                </label>
                <div className="flex gap-3 items-center">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                    <input
                      type="number"
                      placeholder="Min"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#FF3131]/50 transition-colors"
                    />
                  </div>
                  <span className="text-white/30 text-sm">to</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#FF3131]/50 transition-colors"
                    />
                  </div>
                </div>
                {/* Quick Amount Presets */}
                <div className="flex gap-2 mt-2">
                  {[
                    { label: '$0-50', min: '0', max: '50' },
                    { label: '$50-100', min: '50', max: '100' },
                    { label: '$100+', min: '100', max: '' },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setMinAmount(preset.min);
                        setMaxAmount(preset.max);
                      }}
                      className={`px-2 py-1 text-xs border transition-colors ${
                        minAmount === preset.min && maxAmount === preset.max
                          ? 'bg-[#FF3131]/20 border-[#FF3131]/50 text-[#FF3131]'
                          : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:border-white/20'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Filters Summary & Clear All */}
              <div>
                <label className="flex items-center gap-2 text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                  <Funnel size={14} weight="bold" />
                  Active Filters
                </label>
                <div className="p-3 border border-white/10 bg-white/[0.02] min-h-[100px]">
                  {(appliedSearchQuery || statusFilter || paymentStatusFilter || dateRange || selectedStatuses.length > 0 || minAmount || maxAmount) ? (
                    <div className="flex flex-wrap gap-2">
                      {appliedSearchQuery && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 text-xs text-white/70">
                          Search: &quot;{appliedSearchQuery}&quot;
                          <button onClick={() => { setSearchQuery(''); setAppliedSearchQuery(''); }} className="hover:text-white">
                            <X size={12} weight="bold" />
                          </button>
                        </span>
                      )}
                      {statusFilter && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 text-xs text-white/70">
                          Status: {statusFilter}
                          <button onClick={() => setStatusFilter('')} className="hover:text-white">
                            <X size={12} weight="bold" />
                          </button>
                        </span>
                      )}
                      {paymentStatusFilter && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 text-xs text-white/70">
                          Payment: {paymentStatusFilter}
                          <button onClick={() => setPaymentStatusFilter('')} className="hover:text-white">
                            <X size={12} weight="bold" />
                          </button>
                        </span>
                      )}
                      {dateRange && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 text-xs text-white/70">
                          Date Range
                          <button onClick={() => setDateRange(undefined)} className="hover:text-white">
                            <X size={12} weight="bold" />
                          </button>
                        </span>
                      )}
                      {selectedStatuses.map(s => (
                        <span key={s} className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 text-xs text-white/70">
                          {s}
                          <button onClick={() => setSelectedStatuses(selectedStatuses.filter(x => x !== s))} className="hover:text-white">
                            <X size={12} weight="bold" />
                          </button>
                        </span>
                      ))}
                      {(minAmount || maxAmount) && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 text-xs text-white/70">
                          ${minAmount || '0'} - ${maxAmount || '∞'}
                          <button onClick={() => { setMinAmount(''); setMaxAmount(''); }} className="hover:text-white">
                            <X size={12} weight="bold" />
                          </button>
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-white/30 text-center py-4">No active filters</p>
                  )}
                </div>
                {(appliedSearchQuery || statusFilter || paymentStatusFilter || dateRange || selectedStatuses.length > 0 || minAmount || maxAmount) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setAppliedSearchQuery('');
                      setStatusFilter('');
                      setPaymentStatusFilter('');
                      setDateRange(undefined);
                      setSelectedStatuses([]);
                      setMinAmount('');
                      setMaxAmount('');
                    }}
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors"
                  >
                    <X size={14} weight="bold" />
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

        {/* Orders Table */}
        <div className="bg-neutral-900 border border-white/10 overflow-hidden">
          {loading ? (
            <TableSkeleton rows={10} columns={7} />
          ) : orders.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title={searchQuery || statusFilter ? "No Orders Found" : "No Orders Yet"}
              description={
                appliedSearchQuery || statusFilter
                  ? "No orders match your search criteria. Try adjusting your filters."
                  : "Orders will appear here once customers start shopping. Share your store to get started!"
              }
              action={
                appliedSearchQuery || statusFilter
                  ? {
                      label: 'Clear Filters',
                      onClick: () => {
                        setSearchQuery('');
                        setAppliedSearchQuery('');
                        setStatusFilter('');
                        setPage(1);
                      },
                    }
                  : {
                      label: 'View Products',
                      href: '/admin/products',
                    }
              }
              secondaryAction={{
                label: 'Go to Dashboard',
                href: '/admin',
              }}
            />
          ) : (
            <>
              {/* Mobile Cards View */}
              <div className="lg:hidden">
                {/* Mobile bulk select header */}
                <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-sm text-white/70"
                  >
                    {selectedOrders.size === orders.length && orders.length > 0 ? (
                      <CheckSquare size={20} weight="fill" className="text-[#FF3131]" />
                    ) : (
                      <Square size={20} weight="regular" />
                    )}
                    <span>{selectedOrders.size > 0 ? `${selectedOrders.size} selected` : 'Select all'}</span>
                  </button>
                  <span className="text-xs text-white/40">{orders.length} orders</span>
                </div>
                
                {/* Mobile cards list */}
                <div className="divide-y divide-white/10">
                  {orders.map((order) => (
                    <OrderMobileCard
                      key={order.id}
                      order={order}
                      isSelected={selectedOrders.has(order.id)}
                      onSelect={() => toggleSelectOrder(order.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      {/* Bulk select checkbox */}
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={toggleSelectAll}
                          className="text-white/40 hover:text-white transition-colors"
                          title={selectedOrders.size === orders.length ? 'Deselect all' : 'Select all'}
                        >
                          {selectedOrders.size === orders.length && orders.length > 0 ? (
                            <CheckSquare size={18} weight="fill" className="text-[#FF3131]" />
                          ) : (
                            <Square size={18} weight="regular" />
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Order Number
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Customer
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] cursor-pointer hover:text-white/70 transition-colors"
                        onClick={() => handleSort('createdAt')}
                      >
                        <span className="inline-flex items-center gap-1">
                          Date
                          {sortField === 'createdAt' && (
                            sortDirection === 'desc' ? <CaretDown size={12} weight="bold" /> : <CaretUp size={12} weight="bold" />
                          )}
                        </span>
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Items
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] cursor-pointer hover:text-white/70 transition-colors"
                        onClick={() => handleSort('total')}
                      >
                        <span className="inline-flex items-center gap-1">
                          Total
                          {sortField === 'total' && (
                            sortDirection === 'desc' ? <CaretDown size={12} weight="bold" /> : <CaretUp size={12} weight="bold" />
                          )}
                        </span>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] cursor-pointer hover:text-white/70 transition-colors"
                        onClick={() => handleSort('status')}
                      >
                        <span className="inline-flex items-center gap-1">
                          Status
                          {sortField === 'status' && (
                            sortDirection === 'desc' ? <CaretDown size={12} weight="bold" /> : <CaretUp size={12} weight="bold" />
                          )}
                        </span>
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Payment
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {orders.map((order) => (
                      <tr 
                        key={order.id} 
                        className={`hover:bg-white/5 ${selectedOrders.has(order.id) ? 'bg-[#FF3131]/5' : ''}`}
                      >
                        {/* Row checkbox */}
                        <td className="px-4 py-4">
                          <button
                            onClick={() => toggleSelectOrder(order.id)}
                            className="text-white/40 hover:text-white transition-colors"
                          >
                            {selectedOrders.has(order.id) ? (
                              <CheckSquare size={18} weight="fill" className="text-[#FF3131]" />
                            ) : (
                              <Square size={18} weight="regular" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-sm font-medium text-[#FF3131] hover:text-[#E02828] transition-colors"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-white">
                            {order.shippingAddress
                              ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`
                              : 'N/A'}
                          </div>
                          <div className="text-sm text-white/40">
                            {order.customer.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-white/70">
                            {formatDate(order.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-white/70">
                            {order._count?.items || 0} item(s)
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">
                            {formatCurrency(order.total)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {/* Inline status dropdown */}
                          <select
                            value={order.status}
                            onChange={(e) => handleInlineStatusUpdate(order.id, e.target.value)}
                            disabled={updatingOrderId === order.id}
                            className={`text-xs font-semibold px-2 py-1 rounded border-0 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-[#FF3131]/50 disabled:opacity-50 disabled:cursor-wait ${getStatusBadgeColor(order.status)}`}
                          >
                            <option value="PENDING" className="bg-neutral-800 text-white">PENDING</option>
                            <option value="CONFIRMED" className="bg-neutral-800 text-white">CONFIRMED</option>
                            <option value="PROCESSING" className="bg-neutral-800 text-white">PROCESSING</option>
                            <option value="SHIPPED" className="bg-neutral-800 text-white">SHIPPED</option>
                            <option value="DELIVERED" className="bg-neutral-800 text-white">DELIVERED</option>
                            <option value="CANCELLED" className="bg-neutral-800 text-white">CANCELLED</option>
                            <option value="REFUNDED" className="bg-neutral-800 text-white">REFUNDED</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold ${getPaymentStatusBadgeColor(
                              order.paymentStatus
                            )}`}
                          >
                            {order.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white/5 px-6 py-4 border-t border-white/10 flex items-center justify-between">
                  <div className="text-sm text-white/40">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 border border-white/10 text-white/70 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 hover:border-white/20 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 border border-white/10 text-white/70 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 hover:border-white/20 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </AdminLayout>
  );
}
