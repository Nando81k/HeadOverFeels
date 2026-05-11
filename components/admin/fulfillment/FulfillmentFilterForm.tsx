'use client'

import type {
  FulfillmentAgeBucket,
  FulfillmentSortDirection,
  FulfillmentSortField,
} from '@/lib/fulfillment/queue'

export interface FulfillmentFilterFormProps {
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
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
  totalMin: string
  onTotalMinChange: (value: string) => void
  totalMax: string
  onTotalMaxChange: (value: string) => void
  sortBy: FulfillmentSortField
  onSortByChange: (value: FulfillmentSortField) => void
  sortDir: FulfillmentSortDirection
  onToggleSortDir: () => void
  onResetFilters: () => void
  onClose?: () => void
}

const FIELD_CLASS =
  'w-full h-10 px-2.5 rounded-lg border border-white/10 bg-white/5 text-xs text-white focus:outline-none focus:border-white/30'
const LABEL_CLASS = 'block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45'

/**
 * Body content shared between the desktop filter popover and mobile filter sheet.
 *
 * Renders every advanced filter input (status / payment / ticket / assignee /
 * age / date range / total range / sort) in a 2-column grid. The host wrapper
 * decides where this lives (anchored panel vs bottom sheet) and provides the
 * close affordance.
 */
export function FulfillmentFilterForm({
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
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  totalMin,
  onTotalMinChange,
  totalMax,
  onTotalMaxChange,
  sortBy,
  onSortByChange,
  sortDir,
  onToggleSortDir,
  onResetFilters,
  onClose,
}: FulfillmentFilterFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS}>Order status</label>
          <select
            value={orderStatusFilter}
            onChange={(event) => onOrderStatusChange(event.target.value)}
            className={FIELD_CLASS}
          >
            <option value="" className="bg-neutral-900">All</option>
            <option value="CONFIRMED" className="bg-neutral-900">Confirmed</option>
            <option value="PROCESSING" className="bg-neutral-900">Processing</option>
            <option value="SHIPPED" className="bg-neutral-900">Shipped</option>
            <option value="DELIVERED" className="bg-neutral-900">Delivered</option>
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Payment status</label>
          <select
            value={paymentStatusFilter}
            onChange={(event) => onPaymentStatusChange(event.target.value)}
            className={FIELD_CLASS}
          >
            <option value="" className="bg-neutral-900">All</option>
            <option value="PAID" className="bg-neutral-900">Paid</option>
            <option value="PENDING" className="bg-neutral-900">Pending</option>
            <option value="FAILED" className="bg-neutral-900">Failed</option>
            <option value="REFUNDED" className="bg-neutral-900">Refunded</option>
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Ticket status</label>
          <select
            value={ticketStatusFilter}
            onChange={(event) => onTicketStatusChange(event.target.value)}
            className={FIELD_CLASS}
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
          <label className={LABEL_CLASS}>Assignee</label>
          <select
            value={assignedFilter}
            onChange={(event) => onAssignedChange(event.target.value as 'all' | 'assigned' | 'unassigned')}
            className={FIELD_CLASS}
          >
            <option value="all" className="bg-neutral-900">All</option>
            <option value="assigned" className="bg-neutral-900">Assigned</option>
            <option value="unassigned" className="bg-neutral-900">Unassigned</option>
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Age</label>
          <select
            value={ageBucket}
            onChange={(event) => onAgeBucketChange(event.target.value as FulfillmentAgeBucket)}
            className={FIELD_CLASS}
          >
            <option value="all" className="bg-neutral-900">Any</option>
            <option value="over24h" className="bg-neutral-900">{'>'}24h</option>
            <option value="over72h" className="bg-neutral-900">{'>'}72h</option>
            <option value="over168h" className="bg-neutral-900">{'>'}168h</option>
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Sort by</label>
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(event) => onSortByChange(event.target.value as FulfillmentSortField)}
              className={`${FIELD_CLASS} flex-1`}
            >
              <option value="priority" className="bg-neutral-900">Priority</option>
              <option value="createdAt" className="bg-neutral-900">Created</option>
              <option value="ageHours" className="bg-neutral-900">Age</option>
              <option value="total" className="bg-neutral-900">Total</option>
            </select>
            <button
              type="button"
              onClick={onToggleSortDir}
              className="h-10 px-2.5 rounded-lg border border-white/10 bg-white/5 text-xs text-white/75 hover:text-white"
            >
              {sortDir.toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-white/45">Date range</p>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className={FIELD_CLASS}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-white/45">Order total ($)</p>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            min="0"
            step="any"
            value={totalMin}
            onChange={(event) => onTotalMinChange(event.target.value)}
            placeholder="Min"
            className={FIELD_CLASS}
          />
          <input
            type="number"
            min="0"
            step="any"
            value={totalMax}
            onChange={(event) => onTotalMaxChange(event.target.value)}
            placeholder="Max"
            className={FIELD_CLASS}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
        <button
          type="button"
          onClick={onResetFilters}
          className="h-9 px-3 rounded-md border border-white/10 text-xs uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
        >
          Reset all
        </button>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md bg-[#FF3131] text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-[#ff4747]"
          >
            Done
          </button>
        ) : null}
      </div>
    </div>
  )
}
