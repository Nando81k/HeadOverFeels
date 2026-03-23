'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { DateRange } from 'react-day-picker'
import {
  ArrowsClockwise,
  CaretDown,
  CaretUp,
  CheckSquare,
  CurrencyDollar,
  Download,
  Funnel,
  MagnifyingGlass,
  ShoppingCart,
  SpeakerHigh,
  SpeakerSlash,
  Square,
  X,
} from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { OrderMobileCard } from '@/components/admin/OrderMobileCard'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/skeleton'
import {
  AdminOrderFilterState,
  AdminOrderSortDirection,
  AdminOrderSortField,
  ORDER_STATUS_VALUES,
  buildAdminOrdersSearchParams,
  getActiveOrderFilterChips,
} from '@/lib/orders/admin-order-query'
import { useOrderPolling } from '@/lib/hooks/useOrderPolling'
import { toast } from '@/lib/toast'

type Order = {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  total: number
  createdAt: string
  customer: {
    email: string
    phone?: string
  }
  shippingAddress?: {
    firstName: string
    lastName: string
  }
  _count?: {
    items: number
  }
}

type OrdersResponse = {
  data: Order[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

const PAGE_SIZE = 20
const QUICK_STATUS_FILTERS = ['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const

const BULK_STATUS_UPDATES = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const

function getStatusBadgeColor(status: string) {
  const colors: Record<string, string> = {
    PENDING: 'bg-amber-500/20 text-amber-400',
    CONFIRMED: 'bg-blue-500/20 text-blue-400',
    PROCESSING: 'bg-purple-500/20 text-purple-400',
    SHIPPED: 'bg-indigo-500/20 text-indigo-400',
    DELIVERED: 'bg-emerald-500/20 text-emerald-400',
    CANCELLED: 'bg-red-500/20 text-red-400',
    REFUNDED: 'bg-white/10 text-white/70',
  }
  return colors[status] || 'bg-white/10 text-white/70'
}

function getPaymentStatusBadgeColor(status: string) {
  const colors: Record<string, string> = {
    PENDING: 'bg-amber-500/20 text-amber-400',
    PAID: 'bg-emerald-500/20 text-emerald-400',
    FAILED: 'bg-red-500/20 text-red-400',
    REFUNDED: 'bg-white/10 text-white/70',
  }
  return colors[status] || 'bg-white/10 text-white/70'
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)

  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [sortField, setSortField] = useState<AdminOrderSortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<AdminOrderSortDirection>('desc')
  const [showFilters, setShowFilters] = useState(false)

  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)

  const { newOrderCount, isMuted, toggleMute, clearNewOrderCount, isPolling, lastChecked } = useOrderPolling({
    pollingInterval: 30000,
    enabled: true,
    onNewOrders: (count) => {
      toast.success(`${count} New Order${count > 1 ? 's' : ''}!`, 'Check the order queue')
    },
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = searchInput.trim()
      setSearchDebounced((prev) => {
        if (prev !== nextSearch) {
          setPage(1)
        }
        return nextSearch
      })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  const filterState: AdminOrderFilterState = useMemo(
    () => ({
      search: searchDebounced,
      statuses: selectedStatuses,
      paymentStatus: paymentStatusFilter,
      minTotal: minAmount,
      maxTotal: maxAmount,
      dateFrom: dateRange?.from ?? null,
      dateTo: dateRange?.to ?? null,
      sortBy: sortField,
      sortDir: sortDirection,
    }),
    [searchDebounced, selectedStatuses, paymentStatusFilter, minAmount, maxAmount, dateRange, sortField, sortDirection]
  )

  const activeFilterChips = useMemo(() => getActiveOrderFilterChips(filterState), [filterState])

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      const params = buildAdminOrdersSearchParams(filterState, {
        page,
        limit: PAGE_SIZE,
      })

      const response = await fetch(`/api/orders?${params.toString()}`, {
        headers: {
          'x-user-admin': 'true',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }

      const data: OrdersResponse = await response.json()
      setOrders(data.data || [])
      setTotalPages(Math.max(1, data.pagination?.pages || 1))
      setTotalResults(data.pagination?.total || 0)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
      toast.error('Failed to load orders', 'Please try again')
    } finally {
      setLoading(false)
    }
  }, [filterState, page])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    setSelectedOrders((prev) => {
      const currentIds = new Set(orders.map((order) => order.id))
      const next = new Set(Array.from(prev).filter((id) => currentIds.has(id)))
      return next
    })
  }, [orders])

  const handleRefresh = useCallback(() => {
    clearNewOrderCount()
    fetchOrders()
  }, [clearNewOrderCount, fetchOrders])

  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set())
      return
    }
    setSelectedOrders(new Set(orders.map((order) => order.id)))
  }

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  const updateSingleOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId)

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: newStatus } : order)))
      toast.success('Status updated', `Order moved to ${newStatus}`)
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Update failed', 'Could not update order status')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedOrders.size === 0) {
      return
    }

    const loadingToast = toast.loading(`Updating ${selectedOrders.size} orders...`)
    setBulkUpdating(true)

    try {
      await Promise.all(
        Array.from(selectedOrders).map((orderId) =>
          fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          })
        )
      )

      toast.dismiss(loadingToast)
      toast.success('Bulk update completed', `${selectedOrders.size} orders set to ${newStatus}`)
      setSelectedOrders(new Set())
      fetchOrders()
    } catch (error) {
      console.error('Failed bulk update:', error)
      toast.dismiss(loadingToast)
      toast.error('Bulk update failed', 'Some orders could not be updated')
    } finally {
      setBulkUpdating(false)
    }
  }

  const setQuickStatus = (status: (typeof QUICK_STATUS_FILTERS)[number]) => {
    setPage(1)
    if (status === 'ALL') {
      setSelectedStatuses([])
      return
    }
    setSelectedStatuses([status])
  }

  const toggleStatusFilter = (status: string) => {
    setPage(1)
    setSelectedStatuses((prev) => {
      if (prev.includes(status)) {
        return prev.filter((entry) => entry !== status)
      }
      return [...prev, status]
    })
  }

  const clearAllFilters = () => {
    setSearchInput('')
    setSearchDebounced('')
    setSelectedStatuses([])
    setPaymentStatusFilter('')
    setDateRange(undefined)
    setMinAmount('')
    setMaxAmount('')
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

    if (key === 'statuses') {
      setSelectedStatuses([])
      return
    }

    if (key === 'paymentStatus') {
      setPaymentStatusFilter('')
      return
    }

    if (key === 'dateRange') {
      setDateRange(undefined)
      return
    }

    if (key === 'totalRange') {
      setMinAmount('')
      setMaxAmount('')
    }
  }

  const handleExportOrders = async () => {
    const loadingToast = toast.loading('Exporting orders...')

    try {
      const csvContent = [
        ['Order Number', 'Customer', 'Email', 'Date', 'Total', 'Status', 'Payment'].join(','),
        ...orders.map((order) => {
          const customerName = order.shippingAddress
            ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`
            : 'N/A'

          return [
            order.orderNumber,
            customerName,
            order.customer.email,
            formatDate(order.createdAt),
            order.total,
            order.status,
            order.paymentStatus,
          ].join(',')
        }),
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(url)

      toast.dismiss(loadingToast)
      toast.success('Orders exported', `Downloaded ${orders.length} rows`) 
    } catch (error) {
      console.error('Export failed:', error)
      toast.dismiss(loadingToast)
      toast.error('Export failed', 'Please try again')
    }
  }

  const quickStatusActive = selectedStatuses.length === 1 ? selectedStatuses[0] : 'ALL'

  return (
    <AdminLayout
      title="Order Management"
      subtitle="Operator view for triage, fulfillment, and shipping handoff"
      headerActions={
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
            <div className={`h-2 w-2 rounded-full ${isPolling ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/60">Live</span>
            {lastChecked && (
              <span className="text-[10px] text-white/35">
                {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <button
            onClick={handleRefresh}
            className="relative inline-flex items-center justify-center h-10 w-10 border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors rounded-lg"
            title="Refresh orders"
          >
            <ArrowsClockwise size={16} weight="bold" className={loading ? 'animate-spin' : ''} />
            {newOrderCount > 0 && (
              <span className="absolute -top-2 -right-2 inline-flex min-w-5 h-5 px-1 items-center justify-center text-[10px] font-bold text-white bg-[#FF3131] rounded-full">
                {newOrderCount > 99 ? '99+' : newOrderCount}
              </span>
            )}
          </button>

          <button
            onClick={toggleMute}
            className={`inline-flex items-center justify-center h-10 w-10 border rounded-lg transition-colors ${
              isMuted
                ? 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            }`}
            title={isMuted ? 'Unmute notifications' : 'Mute notifications'}
          >
            {isMuted ? <SpeakerSlash size={16} weight="bold" /> : <SpeakerHigh size={16} weight="bold" />}
          </button>

          <button
            onClick={handleExportOrders}
            disabled={orders.length === 0}
            className="hidden sm:inline-flex items-center gap-2 h-10 px-4 border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg"
          >
            <Download size={14} weight="bold" />
            Export
          </button>
        </div>
      }
    >
      <div className="sticky top-0 z-30 space-y-3 bg-neutral-950/95 backdrop-blur pb-4 mb-4">
        <div className="border border-white/10 rounded-xl bg-neutral-900/80 p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center">
            <div className="relative">
              <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search order number, customer, or email"
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#FF3131]/50"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              {QUICK_STATUS_FILTERS.map((status) => {
                const active = quickStatusActive === status
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setQuickStatus(status)}
                    className={`h-9 px-3 text-xs font-medium uppercase tracking-[0.14em] border rounded-md whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-white text-black border-white'
                        : 'bg-white/5 text-white/65 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {status === 'ALL' ? 'All' : status.toLowerCase()}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={sortField}
                onChange={(event) => {
                  setSortField(event.target.value as AdminOrderSortField)
                  setPage(1)
                }}
                className="h-9 px-3 rounded-md border border-white/10 bg-white/5 text-xs uppercase tracking-[0.12em] text-white/75 focus:outline-none focus:border-white/25"
              >
                <option value="createdAt" className="bg-neutral-900">Newest</option>
                <option value="total" className="bg-neutral-900">Total</option>
                <option value="status" className="bg-neutral-900">Status</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                  setPage(1)
                }}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
              >
                {sortDirection === 'asc' ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
              </button>
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={`h-9 px-3 inline-flex items-center gap-2 rounded-md border text-xs uppercase tracking-[0.14em] transition-colors ${
                  showFilters
                    ? 'bg-white/15 border-white/20 text-white'
                    : 'bg-white/5 border-white/10 text-white/65 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Funnel size={14} weight="bold" />
                Filters
              </button>
            </div>

            <div className="text-xs text-white/55 text-right">
              <span className="font-semibold text-white">{totalResults}</span> results
              <span className="mx-2 text-white/20">|</span>
              <span className="font-semibold text-white">{selectedOrders.size}</span> selected
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 pt-3 border-t border-white/10 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              <div>
                <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Payment</label>
                <select
                  value={paymentStatusFilter}
                  onChange={(event) => {
                    setPaymentStatusFilter(event.target.value)
                    setPage(1)
                  }}
                  className="w-full h-9 px-3 rounded-md border border-white/10 bg-white/5 text-sm text-white/80 focus:outline-none focus:border-white/25"
                >
                  <option value="" className="bg-neutral-900">All payments</option>
                  <option value="PENDING" className="bg-neutral-900">Pending</option>
                  <option value="PAID" className="bg-neutral-900">Paid</option>
                  <option value="FAILED" className="bg-neutral-900">Failed</option>
                  <option value="REFUNDED" className="bg-neutral-900">Refunded</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Date range</label>
                <DateRangePicker dateRange={dateRange} onDateRangeChange={(next) => {
                  setDateRange(next)
                  setPage(1)
                }} placeholder="Any date" />
              </div>

              <div>
                <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Min total</label>
                <div className="relative">
                  <CurrencyDollar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    value={minAmount}
                    onChange={(event) => {
                      setMinAmount(event.target.value)
                      setPage(1)
                    }}
                    inputMode="decimal"
                    placeholder="0"
                    className="w-full h-9 pl-7 pr-3 rounded-md border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Max total</label>
                <div className="relative">
                  <CurrencyDollar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    value={maxAmount}
                    onChange={(event) => {
                      setMaxAmount(event.target.value)
                      setPage(1)
                    }}
                    inputMode="decimal"
                    placeholder="No cap"
                    className="w-full h-9 pl-7 pr-3 rounded-md border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Statuses</label>
                <div className="h-9 px-2 rounded-md border border-white/10 bg-white/5 flex items-center gap-1 overflow-x-auto">
                  {ORDER_STATUS_VALUES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => toggleStatusFilter(status)}
                      className={`px-2 py-1 text-[10px] uppercase tracking-[0.12em] rounded border whitespace-nowrap ${
                        selectedStatuses.includes(status)
                          ? 'border-white bg-white text-black'
                          : 'border-white/15 text-white/60 hover:text-white hover:border-white/30'
                      }`}
                    >
                      {status.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {activeFilterChips.length > 0 && (
          <div className="border border-white/10 rounded-xl bg-neutral-900/70 px-3 py-2 flex flex-wrap items-center gap-2">
            {activeFilterChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-2 px-2.5 py-1 text-xs bg-white/10 text-white/80 rounded-md border border-white/10"
              >
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

      {selectedOrders.size > 0 && (
        <div className="sticky top-[144px] z-20 border border-[#FF3131]/30 bg-[#FF3131]/10 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 text-sm text-white">
            <CheckSquare size={16} weight="fill" className="text-[#FF3131]" />
            <span>
              {selectedOrders.size} selected order{selectedOrders.size > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              defaultValue=""
              onChange={(event) => {
                const value = event.target.value
                if (!value) {
                  return
                }
                handleBulkStatusUpdate(value)
                event.target.value = ''
              }}
              disabled={bulkUpdating}
              className="h-9 px-3 rounded-md border border-white/20 bg-black/20 text-sm text-white/85 focus:outline-none focus:border-white/35 disabled:opacity-50"
            >
              <option value="" disabled className="bg-neutral-900">Bulk status update</option>
              {BULK_STATUS_UPDATES.map((status) => (
                <option key={status} value={status} className="bg-neutral-900">
                  {status}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSelectedOrders(new Set())}
              className="h-9 px-3 rounded-md border border-white/15 bg-white/5 text-white/65 hover:text-white hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="border border-white/10 bg-neutral-900 rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton rows={10} columns={8} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No Orders Found"
            description="No orders match the current filter criteria."
            action={{
              label: 'Clear Filters',
              onClick: clearAllFilters,
            }}
          />
        ) : (
          <>
            <div className="lg:hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
                <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-white/70">
                  {selectedOrders.size === orders.length ? (
                    <CheckSquare size={18} weight="fill" className="text-[#FF3131]" />
                  ) : (
                    <Square size={18} weight="regular" />
                  )}
                  <span>{selectedOrders.size > 0 ? `${selectedOrders.size} selected` : 'Select all'}</span>
                </button>
                <span className="text-xs text-white/45">{orders.length} visible</span>
              </div>
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

            <div className="hidden lg:block max-h-[70vh] overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-neutral-950">
                    <th className="sticky top-0 z-10 bg-neutral-950 px-4 py-3 text-left">
                      <button
                        onClick={toggleSelectAll}
                        className="text-white/45 hover:text-white transition-colors"
                        aria-label="Select all orders"
                      >
                        {selectedOrders.size === orders.length ? (
                          <CheckSquare size={18} weight="fill" className="text-[#FF3131]" />
                        ) : (
                          <Square size={18} weight="regular" />
                        )}
                      </button>
                    </th>
                    <th className="sticky top-0 z-10 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Order
                    </th>
                    <th className="sticky top-0 z-10 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Customer
                    </th>
                    <th className="sticky top-0 z-10 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Date
                    </th>
                    <th className="sticky top-0 z-10 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Items
                    </th>
                    <th className="sticky top-0 z-10 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Total
                    </th>
                    <th className="sticky top-0 z-10 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Status
                    </th>
                    <th className="sticky top-0 z-10 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Payment
                    </th>
                    <th className="sticky top-0 z-10 bg-neutral-950 px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.map((order) => (
                    <tr key={order.id} className={selectedOrders.has(order.id) ? 'bg-[#FF3131]/8' : 'hover:bg-white/[0.03]'}>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => toggleSelectOrder(order.id)}
                          className="text-white/45 hover:text-white transition-colors"
                          aria-label={`Select ${order.orderNumber}`}
                        >
                          {selectedOrders.has(order.id) ? (
                            <CheckSquare size={18} weight="fill" className="text-[#FF3131]" />
                          ) : (
                            <Square size={18} weight="regular" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-sm font-semibold text-[#FF3131] hover:text-[#ff5757]"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-sm text-white">
                          {order.shippingAddress
                            ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`
                            : 'N/A'}
                        </div>
                        <div className="text-xs text-white/45">{order.customer.email}</div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-white/70">{formatDate(order.createdAt)}</td>
                      <td className="px-4 py-2.5 text-sm text-white/70">{order._count?.items || 0}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-white">{formatCurrency(order.total)}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={order.status}
                          onChange={(event) => updateSingleOrderStatus(order.id, event.target.value)}
                          disabled={updatingOrderId === order.id}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-md border-0 focus:outline-none focus:ring-1 focus:ring-[#FF3131]/50 disabled:opacity-50 ${getStatusBadgeColor(order.status)}`}
                        >
                          {ORDER_STATUS_VALUES.map((status) => (
                            <option key={status} value={status} className="bg-neutral-900 text-white">
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${getPaymentStatusBadgeColor(order.paymentStatus)}`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex h-8 items-center px-3 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                        >
                          View
                        </Link>
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
    </AdminLayout>
  )
}
