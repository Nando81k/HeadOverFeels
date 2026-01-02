/**
 * Customer Management Page (Revamped)
 * 
 * Admin page for viewing and managing customers with:
 * - Analytics-style metric cards
 * - Segment distribution chart
 * - Activity trends chart
 * - Retention trends chart
 * - Search/filter/sort functionality
 * - CSV export
 * - Glass morphism dark theme with animations
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { SegmentBadge } from '@/components/admin/SegmentBadge';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/lib/toast';
import CustomerMetricCards from '@/components/customers/CustomerMetricCards';
import CustomerSegmentChart from '@/components/customers/CustomerSegmentChart';
import CustomerActivityChart from '@/components/customers/CustomerActivityChart';
import CustomerRetentionChart from '@/components/customers/CustomerRetentionChart';
import {
  fetchCustomers,
  downloadCustomersCSV,
  type CustomerListItem,
  type CustomerListFilters
} from '@/lib/api/customers';
import { type CustomerSegment } from '@/lib/customer-segments';
import { 
  Download, 
  Users, 
  MagnifyingGlass, 
  Funnel, 
  SortAscending,
  CaretDown,
  ChartLine,
  Table,
  ArrowsClockwise
} from '@phosphor-icons/react';

// View mode type
type ViewMode = 'dashboard' | 'list';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<CustomerSegment | ''>('');
  const [sortBy, setSortBy] = useState<CustomerListFilters['sortBy']>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  
  // Analytics data state
  const [analyticsData, setAnalyticsData] = useState<{
    metrics: {
      total: number;
      totalChange: number;
      newCustomers: number;
      newCustomersChange: number;
      vip: number;
      vipChange: number;
      active: number;
      activeChange: number;
      atRisk: number;
      atRiskChange: number;
      inactive: number;
      inactiveChange: number;
      avgOrderValue: number;
      avgOrderValueChange: number;
      retentionRate: number;
      retentionRateChange: number;
    };
    segmentDistribution: Array<{ segment: string; count: number; color: string }>;
    activityTrends: Array<{ month: string; active: number; atRisk: number; inactive: number }>;
    retentionTrends: Array<{ month: string; newCustomers: number; returningCustomers: number; retentionRate: number }>;
  } | null>(null);

  // Fetch customers
  useEffect(() => {
    loadCustomers();
  }, [searchTerm, selectedSegment, sortBy, sortOrder, currentPage]);

  // Fetch analytics data
  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadCustomers() {
    try {
      setLoading(true);
      const filters: CustomerListFilters = {
        search: searchTerm || undefined,
        segment: selectedSegment || undefined,
        sortBy,
        sortOrder,
        page: currentPage,
        limit: 20
      };

      const response = await fetchCustomers(filters);
      setCustomers(response.customers);
      setTotalPages(response.pagination.totalPages);
      setTotalCustomers(response.pagination.total);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics() {
    try {
      setAnalyticsLoading(true);
      const response = await fetch('/api/analytics/customers?period=30d&compareWithPrevious=true');
      const data = await response.json();
      
      if (data.success && data.data) {
        setAnalyticsData({
          metrics: data.data.metrics,
          segmentDistribution: data.data.segmentDistribution,
          activityTrends: data.data.activityTrends,
          retentionTrends: data.data.retentionTrends
        });
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  const handleRefresh = useCallback(() => {
    loadCustomers();
    loadAnalytics();
  }, [searchTerm, selectedSegment, sortBy, sortOrder, currentPage]);

  function handleExportCSV() {
    const loadingToast = toast.loading('Exporting customers...');
    
    try {
      downloadCustomersCSV(customers);
      toast.dismiss(loadingToast);
      toast.success('Customers exported successfully', `Downloaded ${customers.length} customers`);
    } catch {
      toast.dismiss(loadingToast);
      toast.error('Export failed', 'Please try again');
    }
  }

  function handleSort(field: CustomerListFilters['sortBy']) {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  }

  // Default metrics data for loading state
  const defaultMetrics = {
    total: 0,
    totalChange: 0,
    newCustomers: 0,
    newCustomersChange: 0,
    vip: 0,
    vipChange: 0,
    active: 0,
    activeChange: 0,
    atRisk: 0,
    atRiskChange: 0,
    inactive: 0,
    inactiveChange: 0,
    avgOrderValue: 0,
    avgOrderValueChange: 0,
    retentionRate: 0,
    retentionRateChange: 0
  };

  return (
    <AdminLayout
      title="Customer Management"
      subtitle={`${totalCustomers} total customers`}
      headerActions={
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-all ${
                viewMode === 'dashboard' 
                  ? 'bg-white/10 text-white' 
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              <ChartLine size={16} weight="bold" />
              Dashboard
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-all ${
                viewMode === 'list' 
                  ? 'bg-white/10 text-white' 
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              <Table size={16} weight="bold" />
              List
            </button>
          </div>
          
          {/* Refresh Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white transition-all"
          >
            <ArrowsClockwise size={18} weight="bold" />
          </motion.button>

          {/* Export Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportCSV}
            className="px-4 py-2 bg-[#FF3131] hover:bg-[#E02828] text-white transition-colors flex items-center gap-2 rounded-lg"
          >
            <Download size={16} weight="bold" />
            Export CSV
          </motion.button>
        </div>
      }
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Dashboard View */}
        <AnimatePresence mode="wait">
          {viewMode === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Metric Cards */}
              <motion.div variants={itemVariants}>
                <CustomerMetricCards 
                  data={analyticsData?.metrics || defaultMetrics}
                  loading={analyticsLoading}
                />
              </motion.div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Segment Distribution */}
                <motion.div variants={itemVariants}>
                  <CustomerSegmentChart 
                    data={analyticsData?.segmentDistribution || []}
                    loading={analyticsLoading}
                  />
                </motion.div>

                {/* Activity Trends */}
                <motion.div variants={itemVariants}>
                  <CustomerActivityChart 
                    data={analyticsData?.activityTrends || []}
                    loading={analyticsLoading}
                  />
                </motion.div>
              </div>

              {/* Retention Chart - Full Width */}
              <motion.div variants={itemVariants}>
                <CustomerRetentionChart 
                  data={analyticsData?.retentionTrends || []}
                  loading={analyticsLoading}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters - Show in both views */}
        <motion.div 
          variants={itemVariants}
          className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Funnel size={20} weight="bold" className="text-white/40" />
            <h3 className="text-sm font-medium text-white/60">Filters & Search</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                Search
              </label>
              <div className="relative">
                <MagnifyingGlass 
                  size={16} 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" 
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>
            </div>

            {/* Segment Filter */}
            <div className="relative">
              <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                Segment
              </label>
              <div className="relative">
                <select
                  value={selectedSegment}
                  onChange={(e) => {
                    setSelectedSegment(e.target.value as CustomerSegment | '');
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30 appearance-none transition-colors"
                >
                  <option value="" className="bg-neutral-900">All Segments</option>
                  <option value="VIP" className="bg-neutral-900">VIP</option>
                  <option value="New" className="bg-neutral-900">New</option>
                  <option value="Active" className="bg-neutral-900">Active</option>
                  <option value="At-Risk" className="bg-neutral-900">At-Risk</option>
                  <option value="Inactive" className="bg-neutral-900">Inactive</option>
                </select>
                <CaretDown 
                  size={16} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" 
                />
              </div>
            </div>

            {/* Sort */}
            <div className="relative">
              <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                Sort By
              </label>
              <div className="relative">
                <SortAscending 
                  size={16} 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" 
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as CustomerListFilters['sortBy'])}
                  className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30 appearance-none transition-colors"
                >
                  <option value="createdAt" className="bg-neutral-900">Join Date</option>
                  <option value="name" className="bg-neutral-900">Name</option>
                  <option value="email" className="bg-neutral-900">Email</option>
                  <option value="totalSpent" className="bg-neutral-900">Total Spent</option>
                  <option value="totalOrders" className="bg-neutral-900">Total Orders</option>
                  <option value="lastOrderDate" className="bg-neutral-900">Last Order</option>
                </select>
                <CaretDown 
                  size={16} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" 
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Customer Table - Always visible */}
        <motion.div 
          variants={itemVariants}
          className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden"
        >
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={20} weight="bold" className="text-white/40" />
              <h3 className="text-sm font-medium text-white">Customer List</h3>
              <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded">
                {totalCustomers} customers
              </span>
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={10} columns={6} />
          ) : customers.length === 0 ? (
            <EmptyState
              icon={Users}
              title={searchTerm || selectedSegment ? "No Customers Found" : "No Customers Yet"}
              description={
                searchTerm || selectedSegment
                  ? "No customers match your search criteria. Try adjusting your filters."
                  : "Customers will appear here once they create an account or place an order. Start by sharing your store!"
              }
              action={
                searchTerm || selectedSegment
                  ? {
                      label: 'Clear Filters',
                      onClick: () => {
                        setSearchTerm('');
                        setSelectedSegment('');
                        setCurrentPage(1);
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
                <table className="min-w-full divide-y divide-white/5">
                  <thead className="bg-white/5">
                    <tr>
                      <th
                        onClick={() => handleSort('name')}
                        className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          Customer 
                          {sortBy === 'name' && (
                            <span className="text-[#FF3131]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('totalOrders')}
                        className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          Orders 
                          {sortBy === 'totalOrders' && (
                            <span className="text-[#FF3131]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('totalSpent')}
                        className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          Total Spent 
                          {sortBy === 'totalSpent' && (
                            <span className="text-[#FF3131]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('lastOrderDate')}
                        className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          Last Order 
                          {sortBy === 'lastOrderDate' && (
                            <span className="text-[#FF3131]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Segment
                      </th>
                      <th className="px-6 py-3 text-right text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {customers.map((customer, index) => (
                      <motion.tr 
                        key={customer.id} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="hover:bg-white/5 transition-colors group"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-white group-hover:text-[#FF3131] transition-colors">
                              {customer.name || 'N/A'}
                            </div>
                            <div className="text-sm text-white/40">{customer.email}</div>
                            {customer.phone && (
                              <div className="text-sm text-white/30">{customer.phone}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">{customer.totalOrders}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">
                            ${customer.totalSpent.toFixed(2)}
                          </div>
                          {customer.avgOrderValue > 0 && (
                            <div className="text-xs text-white/40">
                              Avg: ${customer.avgOrderValue.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                          {customer.lastOrderDate
                            ? new Date(customer.lastOrderDate).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <SegmentBadge segment={customer.segment as CustomerSegment} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/admin/customers/${customer.id}`}
                            className="inline-flex items-center gap-1 text-white/60 hover:text-[#FF3131] transition-colors"
                          >
                            View Details 
                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                          </Link>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white/5 px-6 py-4 flex items-center justify-between border-t border-white/10">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium text-white/70 bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium text-white/70 bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </motion.button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-white/40">
                        Showing page <span className="font-medium text-white">{currentPage}</span> of{' '}
                        <span className="font-medium text-white">{totalPages}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-white/10 bg-white/5 text-sm font-medium text-white/70 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border border-white/10 bg-white/5 text-sm font-medium text-white/70 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AdminLayout>
  );
}
