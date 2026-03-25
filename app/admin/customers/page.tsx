'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowsClockwise,
  CaretDown,
  CaretUp,
  ChartBar,
  Download,
  Funnel,
  Gift,
  MagnifyingGlass,
  Users,
  X,
} from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/skeleton'
import CustomerMetricCards from '@/components/customers/CustomerMetricCards'
import CustomerSegmentChart from '@/components/customers/CustomerSegmentChart'
import CustomerActivityChart from '@/components/customers/CustomerActivityChart'
import CustomerRetentionChart from '@/components/customers/CustomerRetentionChart'
import { downloadCustomersCSV, type CustomerListItem } from '@/lib/api/customers'
import {
  ADMIN_CUSTOMER_SEGMENTS,
  AdminCustomerFilterState,
  AdminCustomerSortDirection,
  AdminCustomerSortField,
  buildAdminCustomersSearchParams,
  getActiveCustomerFilterChips,
} from '@/lib/customers/admin-customer-query'
import { toast } from '@/lib/toast'

type Customer = {
  id: string
  email: string
  name: string | null
  phone: string | null
  totalSpent: number
  totalOrders: number
  lastOrderDate: string | null
  avgOrderValue: number
  createdAt: string
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
  segment: string
  tier: {
    id: string
    name: string
    slug: string
  } | null
}

type TierOption = {
  id: string
  name: string
  slug: string
}

type CustomersResponse = {
  data: Customer[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  tiers: TierOption[]
}

type CustomerAnalyticsResponse = {
  success: boolean
  data?: {
    metrics: {
      total: number
      totalChange: number
      newCustomers: number
      newCustomersChange: number
      vip: number
      vipChange: number
      active: number
      activeChange: number
      atRisk: number
      atRiskChange: number
      inactive: number
      inactiveChange: number
      avgOrderValue: number
      avgOrderValueChange: number
      retentionRate: number
      retentionRateChange: number
    }
    segmentDistribution: Array<{ segment: string; count: number; color: string }>
    activityTrends: Array<{ month: string; active: number; atRisk: number; inactive: number }>
    retentionTrends: Array<{
      month: string
      newCustomers: number
      returningCustomers: number
      retentionRate: number
    }>
  }
}

const PAGE_SIZE = 20

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
  retentionRateChange: 0,
}

function formatDate(value: string | null) {
  if (!value) return 'Never'
  return new Date(value).toLocaleDateString()
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function toCustomerListItem(customer: Customer): CustomerListItem {
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    totalSpent: customer.totalSpent,
    totalOrders: customer.totalOrders,
    lastOrderDate: customer.lastOrderDate ? new Date(customer.lastOrderDate) : null,
    avgOrderValue: customer.avgOrderValue,
    segment: customer.segment,
    currentPoints: customer.currentPoints,
    lifetimePoints: customer.lifetimePoints,
    annualPointsEarned: customer.annualPointsEarned,
    tier: customer.tier,
    createdAt: new Date(customer.createdAt),
  }
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [tiers, setTiers] = useState<TierOption[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)

  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [segmentFilter, setSegmentFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [minSpent, setMinSpent] = useState('')
  const [minOrders, setMinOrders] = useState('')
  const [sortField, setSortField] = useState<AdminCustomerSortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<AdminCustomerSortDirection>('desc')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const [showAnalytics, setShowAnalytics] = useState(false)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<CustomerAnalyticsResponse['data'] | null>(null)

  const [showGiftModal, setShowGiftModal] = useState(false)
  const [showTierModal, setShowTierModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [giftPoints, setGiftPoints] = useState('')
  const [giftReason, setGiftReason] = useState('')
  const [selectedTierId, setSelectedTierId] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim()
      setSearchDebounced((prev) => {
        if (prev !== next) {
          setPage(1)
        }
        return next
      })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  const filterState: AdminCustomerFilterState = useMemo(
    () => ({
      search: searchDebounced,
      segment: segmentFilter,
      tier: tierFilter,
      minSpent,
      minOrders,
      sortBy: sortField,
      sortDir: sortDirection,
    }),
    [searchDebounced, segmentFilter, tierFilter, minSpent, minOrders, sortField, sortDirection]
  )

  const activeFilterChips = useMemo(() => getActiveCustomerFilterChips(filterState), [filterState])

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true)
      const params = buildAdminCustomersSearchParams(filterState, {
        page,
        limit: PAGE_SIZE,
      })

      const response = await fetch(`/api/admin/customers?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch customers')
      }

      const result: CustomersResponse = await response.json()
      setCustomers(result.data || [])
      setTiers(result.tiers || [])
      setTotalPages(Math.max(1, result.pagination?.pages || 1))
      setTotalResults(result.pagination?.total || 0)
    } catch (error) {
      console.error('Failed to load customers:', error)
      toast.error('Failed to load customers', 'Please try again')
    } finally {
      setLoading(false)
    }
  }, [filterState, page])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true)
      const response = await fetch('/api/analytics/customers?period=30d&compareWithPrevious=true')
      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }

      const result: CustomerAnalyticsResponse = await response.json()
      if (result.success && result.data) {
        setAnalyticsData(result.data)
      }
      setAnalyticsLoaded(true)
    } catch (error) {
      console.error('Failed to load customer analytics:', error)
      toast.error('Failed to load analytics', 'Please try again')
    } finally {
      setAnalyticsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (showAnalytics && !analyticsLoaded && !analyticsLoading) {
      fetchAnalytics()
    }
  }, [showAnalytics, analyticsLoaded, analyticsLoading, fetchAnalytics])

  const handleRefresh = () => {
    fetchCustomers()
    if (showAnalytics) {
      fetchAnalytics()
    }
  }

  const clearAllFilters = () => {
    setSearchInput('')
    setSearchDebounced('')
    setSegmentFilter('')
    setTierFilter('')
    setMinSpent('')
    setMinOrders('')
    setSortField('createdAt')
    setSortDirection('desc')
    setPage(1)
  }

  const removeFilterChip = (key: string) => {
    setPage(1)
    if (key === 'search') {
      setSearchInput('')
      setSearchDebounced('')
      return
    }
    if (key === 'segment') {
      setSegmentFilter('')
      return
    }
    if (key === 'tier') {
      setTierFilter('')
      return
    }
    if (key === 'minSpent') {
      setMinSpent('')
      return
    }
    if (key === 'minOrders') {
      setMinOrders('')
    }
  }

  const handleExportCSV = async () => {
    const loadingToast = toast.loading('Exporting filtered customers...')
    try {
      const params = buildAdminCustomersSearchParams(filterState, {
        page: 1,
        limit: 5000,
      })
      const response = await fetch(`/api/admin/customers?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to export customers')
      }
      const result: CustomersResponse = await response.json()
      downloadCustomersCSV((result.data || []).map(toCustomerListItem))
      toast.dismiss(loadingToast)
      toast.success('Customer export ready', `Downloaded ${result.data?.length || 0} rows`)
    } catch (error) {
      console.error('Failed to export customers:', error)
      toast.dismiss(loadingToast)
      toast.error('Export failed', 'Please try again')
    }
  }

  const openGiftModal = (customer: Customer) => {
    setSelectedCustomer(customer)
    setGiftPoints('')
    setGiftReason('')
    setShowGiftModal(true)
  }

  const openTierModal = (customer: Customer) => {
    setSelectedCustomer(customer)
    setSelectedTierId(customer.tier?.id || '')
    setShowTierModal(true)
  }

  const submitGiftPoints = async () => {
    if (!selectedCustomer) return
    const parsedPoints = Number.parseInt(giftPoints, 10)
    if (!Number.isFinite(parsedPoints) || parsedPoints <= 0) {
      toast.error('Invalid points amount', 'Enter a value greater than 0')
      return
    }

    setActionLoading(true)
    try {
      const response = await fetch('/api/admin/loyalty/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          action: 'adjustPoints',
          points: parsedPoints,
          reason: giftReason.trim() || 'Admin gift points',
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to gift points')
      }

      toast.success('Points gifted', `${parsedPoints} points added`)
      setShowGiftModal(false)
      setSelectedCustomer(null)
      fetchCustomers()
    } catch (error) {
      console.error('Failed to gift points:', error)
      toast.error('Gift failed', error instanceof Error ? error.message : 'Could not gift points')
    } finally {
      setActionLoading(false)
    }
  }

  const submitTierChange = async () => {
    if (!selectedCustomer || !selectedTierId) return

    setActionLoading(true)
    try {
      const response = await fetch('/api/admin/loyalty/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          action: 'changeTier',
          tierId: selectedTierId,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to change tier')
      }

      toast.success('Tier updated')
      setShowTierModal(false)
      setSelectedCustomer(null)
      fetchCustomers()
    } catch (error) {
      console.error('Failed to change tier:', error)
      toast.error('Tier update failed', error instanceof Error ? error.message : 'Could not update tier')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <AdminLayout
      title="Customer Management"
      subtitle="Primary workspace for customer triage and loyalty operations"
      headerActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAnalytics((prev) => !prev)}
            className="inline-flex items-center gap-2 h-10 px-4 border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
          >
            <ChartBar size={15} weight="bold" />
            Snapshot
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center justify-center h-10 w-10 border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
          >
            <ArrowsClockwise size={16} weight="bold" />
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 h-10 px-4 border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
          >
            <Download size={14} weight="bold" />
            Export
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {showAnalytics && (
          <div className="border border-white/10 rounded-xl bg-neutral-900/70 p-4">
            <div className="mb-3">
              <p className="text-xs uppercase tracking-[0.16em] text-white/40">Performance Snapshot</p>
            </div>
            <div className="space-y-4">
              <CustomerMetricCards data={analyticsData?.metrics || defaultMetrics} loading={analyticsLoading} />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <CustomerSegmentChart
                  data={analyticsData?.segmentDistribution || []}
                  loading={analyticsLoading}
                />
                <CustomerActivityChart
                  data={analyticsData?.activityTrends || []}
                  loading={analyticsLoading}
                />
              </div>
              <CustomerRetentionChart
                data={analyticsData?.retentionTrends || []}
                loading={analyticsLoading}
              />
            </div>
          </div>
        )}

        <div className="sticky top-0 z-20 bg-neutral-950/95 backdrop-blur pb-4 space-y-3">
          <div className="border border-white/10 rounded-xl bg-neutral-900 p-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center">
              <div className="relative">
                <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search customer by name or email"
                  className="w-full h-10 pl-10 pr-3 rounded-lg border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#FF3131]/50"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
                <button
                  type="button"
                  onClick={() => {
                    setSegmentFilter('')
                    setPage(1)
                  }}
                  className={`h-9 px-3 rounded-md border text-xs uppercase tracking-[0.12em] whitespace-nowrap ${
                    !segmentFilter
                      ? 'bg-white text-black border-white'
                      : 'bg-white/5 text-white/65 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  All
                </button>
                {ADMIN_CUSTOMER_SEGMENTS.map((segment) => (
                  <button
                    key={segment}
                    type="button"
                    onClick={() => {
                      setSegmentFilter(segment)
                      setPage(1)
                    }}
                    className={`h-9 px-3 rounded-md border text-xs uppercase tracking-[0.12em] whitespace-nowrap ${
                      segmentFilter === segment
                        ? 'bg-white text-black border-white'
                        : 'bg-white/5 text-white/65 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {segment}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sortField}
                  onChange={(event) => {
                    setSortField(event.target.value as AdminCustomerSortField)
                    setPage(1)
                  }}
                  className="h-9 px-3 rounded-md border border-white/10 bg-white/5 text-xs uppercase tracking-[0.12em] text-white/70 focus:outline-none focus:border-white/30"
                >
                  <option value="createdAt" className="bg-neutral-900">Newest</option>
                  <option value="totalSpent" className="bg-neutral-900">Total Spent</option>
                  <option value="totalOrders" className="bg-neutral-900">Orders</option>
                  <option value="lastOrderDate" className="bg-neutral-900">Last Order</option>
                  <option value="currentPoints" className="bg-neutral-900">Points</option>
                  <option value="name" className="bg-neutral-900">Name</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                    setPage(1)
                  }}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {sortDirection === 'asc' ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters((prev) => !prev)}
                  className={`h-9 px-3 inline-flex items-center gap-2 rounded-md border text-xs uppercase tracking-[0.14em] ${
                    showAdvancedFilters
                      ? 'bg-white/15 border-white/20 text-white'
                      : 'bg-white/5 border-white/10 text-white/65 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Funnel size={14} weight="bold" />
                  Filters
                </button>
              </div>

              <div className="text-xs text-white/55 text-right">
                <span className="font-semibold text-white">{totalResults}</span> customers
              </div>
            </div>

            {showAdvancedFilters && (
              <div className="mt-3 pt-3 border-t border-white/10 grid gap-3 md:grid-cols-3">
                <div>
                  <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Tier</label>
                  <select
                    value={tierFilter}
                    onChange={(event) => {
                      setTierFilter(event.target.value)
                      setPage(1)
                    }}
                    className="w-full h-9 px-3 rounded-md border border-white/10 bg-white/5 text-sm text-white/80 focus:outline-none focus:border-white/30"
                  >
                    <option value="" className="bg-neutral-900">All tiers</option>
                    {tiers.map((tier) => (
                      <option key={tier.id} value={tier.id} className="bg-neutral-900">
                        {tier.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Min Spent</label>
                  <input
                    value={minSpent}
                    onChange={(event) => {
                      setMinSpent(event.target.value)
                      setPage(1)
                    }}
                    inputMode="decimal"
                    placeholder="0"
                    className="w-full h-9 px-3 rounded-md border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Min Orders</label>
                  <input
                    value={minOrders}
                    onChange={(event) => {
                      setMinOrders(event.target.value)
                      setPage(1)
                    }}
                    inputMode="numeric"
                    placeholder="0"
                    className="w-full h-9 px-3 rounded-md border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>
            )}
          </div>

          {activeFilterChips.length > 0 && (
            <div className="border border-white/10 rounded-xl bg-neutral-900/70 px-3 py-2 flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <span key={chip.key} className="inline-flex items-center gap-2 px-2.5 py-1 text-xs bg-white/10 text-white/80 rounded-md border border-white/10">
                  <span className="text-white/45 uppercase tracking-[0.12em]">{chip.label}</span>
                  <span className="font-medium">{chip.value}</span>
                  <button
                    type="button"
                    onClick={() => removeFilterChip(chip.key)}
                    className="text-white/55 hover:text-white"
                    aria-label={`Remove ${chip.label}`}
                  >
                    <X size={12} weight="bold" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                className="ml-auto text-xs uppercase tracking-[0.14em] text-white/60 hover:text-white"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        <div className="border border-white/10 bg-neutral-900 rounded-xl overflow-hidden">
          {loading ? (
            <TableSkeleton rows={10} columns={8} />
          ) : customers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Customers Found"
              description="No customers match the current filters."
              action={{
                label: 'Clear Filters',
                onClick: clearAllFilters,
              }}
            />
          ) : (
            <>
              <div className="lg:hidden divide-y divide-white/10">
                {customers.map((customer) => (
                  <div key={customer.id} className="p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{customer.name || 'Unnamed Customer'}</p>
                      <p className="text-xs text-white/50">{customer.email}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-white/40">Spent</p>
                        <p className="text-white font-medium">{formatCurrency(customer.totalSpent)}</p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-white/40">Orders</p>
                        <p className="text-white font-medium">{customer.totalOrders}</p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-white/40">Points</p>
                        <p className="text-white font-medium">{customer.currentPoints.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="h-8 px-3 inline-flex items-center rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => openGiftModal(customer)}
                        className="h-8 px-3 inline-flex items-center rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                      >
                        Gift
                      </button>
                      <button
                        type="button"
                        onClick={() => openTierModal(customer)}
                        className="h-8 px-3 inline-flex items-center rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                      >
                        Tier
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden lg:block max-h-[70vh] overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-neutral-950">
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Customer</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Segment</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Tier</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-white/40">Orders</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-white/40">Spent</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-white/40">Points</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Last Order</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-white/40">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-3">
                          <p className="text-sm text-white font-medium">{customer.name || 'Unnamed Customer'}</p>
                          <p className="text-xs text-white/45">{customer.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-1 rounded text-xs bg-white/10 text-white/75">
                            {customer.segment}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-white/70">{customer.tier?.name || 'None'}</td>
                        <td className="px-4 py-3 text-sm text-white text-right">{customer.totalOrders}</td>
                        <td className="px-4 py-3 text-sm text-white text-right">{formatCurrency(customer.totalSpent)}</td>
                        <td className="px-4 py-3 text-sm text-white text-right">{customer.currentPoints.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-white/70">{formatDate(customer.lastOrderDate)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openGiftModal(customer)}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                              title="Gift points"
                            >
                              <Gift size={14} weight="bold" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openTierModal(customer)}
                              className="h-8 px-3 inline-flex items-center rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                            >
                              Tier
                            </button>
                            <Link
                              href={`/admin/customers/${customer.id}`}
                              className="h-8 px-3 inline-flex items-center rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/45">
                    Page <span className="text-white">{page}</span> of <span className="text-white">{totalPages}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page <= 1}
                      className="h-8 px-3 rounded-md border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page >= totalPages}
                      className="h-8 px-3 rounded-md border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showGiftModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white">Gift Points</h3>
            <p className="text-sm text-white/60 mt-1 mb-4">
              {selectedCustomer.name || selectedCustomer.email} currently has {selectedCustomer.currentPoints.toLocaleString()} points.
            </p>
            <div className="space-y-3">
              <input
                value={giftPoints}
                onChange={(event) => setGiftPoints(event.target.value)}
                inputMode="numeric"
                placeholder="Points amount"
                className="w-full h-10 px-3 rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
              />
              <textarea
                value={giftReason}
                onChange={(event) => setGiftReason(event.target.value)}
                placeholder="Reason (optional)"
                rows={3}
                className="w-full px-3 py-2 rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 resize-none"
              />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGiftModal(false)}
                className="h-9 px-4 rounded-md border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitGiftPoints}
                className="h-9 px-4 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4a4a] disabled:opacity-50"
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : 'Gift Points'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTierModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white">Change Tier</h3>
            <p className="text-sm text-white/60 mt-1 mb-4">
              Update tier for {selectedCustomer.name || selectedCustomer.email}.
            </p>
            <select
              value={selectedTierId}
              onChange={(event) => setSelectedTierId(event.target.value)}
              className="w-full h-10 px-3 rounded-md border border-white/10 bg-white/5 text-white focus:outline-none focus:border-white/30"
            >
              <option value="" className="bg-neutral-900">Select tier</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id} className="bg-neutral-900">
                  {tier.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTierModal(false)}
                className="h-9 px-4 rounded-md border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitTierChange}
                className="h-9 px-4 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4a4a] disabled:opacity-50"
                disabled={actionLoading || !selectedTierId}
              >
                {actionLoading ? 'Saving...' : 'Update Tier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
