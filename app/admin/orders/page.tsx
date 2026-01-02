'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/lib/toast';
import { ShoppingCart, Download, Funnel, X } from '@phosphor-icons/react';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { isWithinInterval } from 'date-fns';

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
  const [searchQuery, setSearchQuery] = useState('');
  
  // Advanced filters
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('email', searchQuery);

      const response = await fetch(`/api/orders?${params}`);
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
        
        setOrders(filteredOrders);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchQuery, dateRange, selectedStatuses, minAmount, maxAmount]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
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
        <button
          onClick={handleExportOrders}
          disabled={orders.length === 0}
          className="inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium text-white bg-white/5 hover:bg-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none transition-colors"
        >
          <Download size={16} weight="bold" className="mr-2" />
          Export Orders
        </button>
      }
    >
      {/* Filters and Search */}
      <div className="bg-neutral-900 border border-white/10 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white tracking-[0.1em] uppercase">Search & Filters</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors"
          >
            <Funnel size={16} weight="bold" className="mr-2" />
            {showFilters ? 'Hide' : 'Show'} Advanced Filters
          </button>
        </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="md:col-span-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search by customer email or order number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-4 py-2 bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                />
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#FF3131] text-white hover:bg-[#E02828] transition-colors"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30"
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
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Date Range */}
                <div>
                  <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                    Date Range
                  </label>
                  <DateRangePicker
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    placeholder="Select date range"
                  />
                </div>

                {/* Multi-Status Select */}
                <div>
                  <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                    Multiple Statuses
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-white/10 bg-white/5 p-2">
                    {['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].map(status => (
                      <label key={status} className="flex items-center">
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
                          className="border-white/30 bg-white/5 text-[#FF3131] focus:ring-[#FF3131] mr-2"
                        />
                        <span className="text-sm text-white/70">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                    Order Total Range
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      placeholder="Min"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                    />
                    <span className="text-white/40">to</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                    />
                  </div>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(dateRange || selectedStatuses.length > 0 || minAmount || maxAmount) && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setDateRange(undefined);
                      setSelectedStatuses([]);
                      setMinAmount('');
                      setMaxAmount('');
                    }}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors"
                  >
                    <X size={16} weight="bold" className="mr-2" />
                    Clear All Filters
                  </button>
                </div>
              )}
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
                searchQuery || statusFilter
                  ? "No orders match your search criteria. Try adjusting your filters."
                  : "Orders will appear here once customers start shopping. Share your store to get started!"
              }
              action={
                searchQuery || statusFilter
                  ? {
                      label: 'Clear Filters',
                      onClick: () => {
                        setSearchQuery('');
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Order Number
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Payment
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-white/5">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">
                            {order.orderNumber}
                          </div>
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
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold ${getStatusBadgeColor(
                              order.status
                            )}`}
                          >
                            {order.status}
                          </span>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-[#FF3131] hover:text-[#E02828] font-medium"
                          >
                            View Details →
                          </Link>
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
