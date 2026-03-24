'use client'

import { ArrowsClockwise, X } from '@phosphor-icons/react'
import type {
  FulfillmentAgeBucket,
  FulfillmentQueueType,
  FulfillmentSortDirection,
  FulfillmentSortField,
} from '@/lib/fulfillment/queue'

type FilterChip = {
  key: string
  label: string
  value: string
  clear: () => void
}

interface FulfillmentCommandBarProps {
  searchInput: string
  onSearchChange: (value: string) => void
  orderStatusFilter: string
  onOrderStatusChange: (value: string) => void
  paymentStatusFilter: string
  onPaymentStatusChange: (value: string) => void
  ticketStatusFilter: string
  onTicketStatusChange: (value: string) => void
  assignedFilter: 'all' | 'assigned' | 'unassigned'
  onAssignedChange: (value: 'all' | 'assigned' | 'unassigned') => void
  ageBucket: FulfillmentAgeBucket
  onAgeBucketChange: (value: FulfillmentAgeBucket) => void
  sortBy: FulfillmentSortField
  onSortByChange: (value: FulfillmentSortField) => void
  sortDir: FulfillmentSortDirection
  onToggleSortDir: () => void
  totalResults: number
  refreshing: boolean
  onRefresh: () => void
  selectedQueueTypes: FulfillmentQueueType[]
  onToggleQueueType: (queueType: FulfillmentQueueType) => void
  queueTypeCounts: Record<FulfillmentQueueType, number>
  queueLabels: Record<FulfillmentQueueType, string>
  queueTypes: readonly FulfillmentQueueType[]
  onResetFilters: () => void
  activeFilterChips: FilterChip[]
}

export function FulfillmentCommandBar({
  searchInput,
  onSearchChange,
  orderStatusFilter,
  onOrderStatusChange,
  paymentStatusFilter,
  onPaymentStatusChange,
  ticketStatusFilter,
  onTicketStatusChange,
  assignedFilter,
  onAssignedChange,
  ageBucket,
  onAgeBucketChange,
  sortBy,
  onSortByChange,
  sortDir,
  onToggleSortDir,
  totalResults,
  refreshing,
  onRefresh,
  selectedQueueTypes,
  onToggleQueueType,
  queueTypeCounts,
  queueLabels,
  queueTypes,
  onResetFilters,
  activeFilterChips,
}: FulfillmentCommandBarProps) {
  const visibleChips = activeFilterChips.slice(0, 5)
  const hiddenChipCount = Math.max(0, activeFilterChips.length - visibleChips.length)

  return (
    <section className="space-y-2">
      <div className="rounded-xl border border-white/10 bg-neutral-900/80 p-3 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(6,minmax(120px,1fr))_auto]">
        <div>
          <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">Search</label>
          <input
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Order #, ticket #, customer, email"
            className="w-full h-10 px-3 rounded-lg border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#FF3131]/50"
          />
        </div>

        <div>
          <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">Order</label>
          <select
            value={orderStatusFilter}
            onChange={(event) => onOrderStatusChange(event.target.value)}
            className="w-full h-10 px-2.5 rounded-lg border border-white/10 bg-white/5 text-xs text-white focus:outline-none focus:border-white/30"
          >
            <option value="" className="bg-neutral-900">All</option>
            <option value="CONFIRMED" className="bg-neutral-900">Confirmed</option>
            <option value="PROCESSING" className="bg-neutral-900">Processing</option>
            <option value="SHIPPED" className="bg-neutral-900">Shipped</option>
            <option value="DELIVERED" className="bg-neutral-900">Delivered</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">Payment</label>
          <select
            value={paymentStatusFilter}
            onChange={(event) => onPaymentStatusChange(event.target.value)}
            className="w-full h-10 px-2.5 rounded-lg border border-white/10 bg-white/5 text-xs text-white focus:outline-none focus:border-white/30"
          >
            <option value="" className="bg-neutral-900">All</option>
            <option value="PAID" className="bg-neutral-900">Paid</option>
            <option value="PENDING" className="bg-neutral-900">Pending</option>
            <option value="FAILED" className="bg-neutral-900">Failed</option>
            <option value="REFUNDED" className="bg-neutral-900">Refunded</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">Ticket</label>
          <select
            value={ticketStatusFilter}
            onChange={(event) => onTicketStatusChange(event.target.value)}
            className="w-full h-10 px-2.5 rounded-lg border border-white/10 bg-white/5 text-xs text-white focus:outline-none focus:border-white/30"
          >
            <option value="" className="bg-neutral-900">All</option>
            <option value="OPEN" className="bg-neutral-900">Open</option>
            <option value="IN_PROGRESS" className="bg-neutral-900">In Progress</option>
            <option value="WAITING_CUSTOMER" className="bg-neutral-900">Waiting</option>
            <option value="ESCALATED" className="bg-neutral-900">Escalated</option>
            <option value="RESOLVED" className="bg-neutral-900">Resolved</option>
            <option value="CLOSED" className="bg-neutral-900">Closed</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">Assignee</label>
          <select
            value={assignedFilter}
            onChange={(event) => onAssignedChange(event.target.value as 'all' | 'assigned' | 'unassigned')}
            className="w-full h-10 px-2.5 rounded-lg border border-white/10 bg-white/5 text-xs text-white focus:outline-none focus:border-white/30"
          >
            <option value="all" className="bg-neutral-900">All</option>
            <option value="assigned" className="bg-neutral-900">Assigned</option>
            <option value="unassigned" className="bg-neutral-900">Unassigned</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">Age</label>
          <select
            value={ageBucket}
            onChange={(event) => onAgeBucketChange(event.target.value as FulfillmentAgeBucket)}
            className="w-full h-10 px-2.5 rounded-lg border border-white/10 bg-white/5 text-xs text-white focus:outline-none focus:border-white/30"
          >
            <option value="all" className="bg-neutral-900">Any</option>
            <option value="over24h" className="bg-neutral-900">{'>'}24h</option>
            <option value="over72h" className="bg-neutral-900">{'>'}72h</option>
            <option value="over168h" className="bg-neutral-900">{'>'}168h</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">Sort</label>
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(event) => onSortByChange(event.target.value as FulfillmentSortField)}
              className="w-full h-10 px-2 rounded-lg border border-white/10 bg-white/5 text-xs text-white focus:outline-none focus:border-white/30"
            >
              <option value="priority" className="bg-neutral-900">Priority</option>
              <option value="createdAt" className="bg-neutral-900">Created</option>
              <option value="ageHours" className="bg-neutral-900">Age</option>
              <option value="total" className="bg-neutral-900">Total</option>
            </select>
            <button
              onClick={onToggleSortDir}
              className="h-10 px-2.5 rounded-lg border border-white/10 bg-white/5 text-xs text-white/75 hover:text-white"
            >
              {sortDir.toUpperCase()}
            </button>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-1">Results</p>
          <p className="text-sm font-semibold text-white">{totalResults}</p>
          <button
            onClick={onRefresh}
            className="mt-1 inline-flex items-center gap-1 text-xs text-white/55 hover:text-white"
          >
            <ArrowsClockwise className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-neutral-900/70 px-3 py-2 flex flex-wrap items-center gap-2">
        {queueTypes.map((type) => {
          const active = selectedQueueTypes.includes(type)
          return (
            <button
              key={type}
              onClick={() => onToggleQueueType(type)}
              className={`h-8 px-3 rounded-md border text-xs uppercase tracking-[0.12em] transition ${
                active
                  ? 'border-white bg-white text-black'
                  : 'border-white/10 text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {queueLabels[type]} ({queueTypeCounts[type] || 0})
            </button>
          )
        })}
        <button
          onClick={onResetFilters}
          className="ml-auto h-8 px-3 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
        >
          Reset Filters
        </button>
      </div>

      {activeFilterChips.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-neutral-900/70 px-3 py-2 flex flex-wrap items-center gap-2">
          {visibleChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-white/10 bg-white/10 text-xs text-white/80"
            >
              <span className="uppercase tracking-[0.12em] text-white/45">{chip.label}</span>
              <span>{chip.value}</span>
              <button onClick={chip.clear} className="text-white/55 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          {hiddenChipCount > 0 ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-white/10 bg-white/5 text-xs text-white/55">
              +{hiddenChipCount} more
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
