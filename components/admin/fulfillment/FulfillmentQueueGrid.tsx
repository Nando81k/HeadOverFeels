'use client'

import {
  CaretLeft,
  CaretRight,
  CheckSquare,
  Square,
} from '@phosphor-icons/react'
import type {
  FulfillmentBlocker,
  FulfillmentNextAction,
  FulfillmentQueueType,
} from '@/lib/fulfillment/queue'
import type { FulfillmentQueueRowViewModel } from '@/lib/fulfillment/console'

type Pagination = {
  page: number
  pages: number
  total: number
}

interface FulfillmentQueueGridProps {
  loading: boolean
  rows: FulfillmentQueueRowViewModel[]
  activeRowId: string | null
  onSelectRow: (row: FulfillmentQueueRowViewModel) => void
  selectedOrderIds: Set<string>
  allRowsSelected: boolean
  onToggleSelectAll: () => void
  onToggleSelectOrder: (orderId: string) => void
  onPurchaseSingleLabel: (orderId: string) => void
  onRunNextAction: (row: FulfillmentQueueRowViewModel) => void
  pagination: Pagination
  onPrevPage: () => void
  onNextPage: () => void
  queueLabels: Record<FulfillmentQueueType, string>
  nextActionLabels: Record<FulfillmentNextAction, string>
  blockerLabels: Record<FulfillmentBlocker, string>
  statusClassName: (status: string | null | undefined) => string
  formatCurrency: (amount: number | null | undefined) => string
  dense: boolean
}

export function FulfillmentQueueGrid({
  loading,
  rows,
  activeRowId,
  onSelectRow,
  selectedOrderIds,
  allRowsSelected,
  onToggleSelectAll,
  onToggleSelectOrder,
  onPurchaseSingleLabel,
  onRunNextAction,
  pagination,
  onPrevPage,
  onNextPage,
  queueLabels,
  nextActionLabels,
  blockerLabels,
  statusClassName,
  formatCurrency,
  dense,
}: FulfillmentQueueGridProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-neutral-900 overflow-hidden h-full flex flex-col">
      <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Fulfillment Queue</p>
          <p className="text-[11px] text-white/45">Unified operations table with lane-based exceptions</p>
        </div>
        <button
          onClick={onToggleSelectAll}
          className="text-xs text-white/65 hover:text-white inline-flex items-center gap-1"
        >
          {allRowsSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {allRowsSelected ? 'Deselect all' : 'Select all'}
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="px-4 py-12 text-center text-white/45">Loading queue...</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-white/45">No queue items match current filters.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-neutral-950">
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  <button
                    onClick={onToggleSelectAll}
                    className="text-white/45 hover:text-white transition-colors"
                    aria-label="Select all visible queue rows"
                  >
                    {allRowsSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Lane
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Record
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Customer
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Age
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Status
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Total
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Blockers
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Next Action
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Owner
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-right text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Inspect
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row) => {
                const isActive = row.id === activeRowId
                const rowSelectable = Boolean(row.orderId)
                const selected = row.orderId ? selectedOrderIds.has(row.orderId) : false
                const recordCode = row.orderNumber || row.ticketNumber || 'Record'
                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelectRow(row)}
                    className={`cursor-pointer transition ${
                      isActive ? 'bg-white/10' : 'hover:bg-white/[0.06]'
                    }`}
                  >
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'}`} onClick={(event) => event.stopPropagation()}>
                      {rowSelectable && row.orderId ? (
                        <button
                          onClick={() => onToggleSelectOrder(row.orderId as string)}
                          aria-label={selected ? 'Deselect row' : 'Select row'}
                          className="text-white/45 hover:text-white transition-colors"
                        >
                          {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                      ) : (
                        <span className="text-white/25">-</span>
                      )}
                    </td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'}`}>
                      <span className="inline-flex items-center rounded border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/80">
                        {queueLabels[row.queueType as FulfillmentQueueType] || row.laneLabel}
                      </span>
                    </td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'}`}>
                      <p className="text-[11px] font-semibold text-white truncate">{recordCode}</p>
                      {row.ticketSubject ? <p className="text-[10px] text-white/45 truncate">{row.ticketSubject}</p> : null}
                    </td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'}`}>
                      <p className="text-[11px] text-white truncate">{row.customerName}</p>
                      <p className="text-[10px] text-white/45 truncate">{row.customerEmail}</p>
                    </td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} text-[11px] text-white/65`}>{row.ageHours}h</td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'}`}>
                      <div className="flex flex-wrap items-center gap-1">
                        {row.orderStatus ? (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] ${statusClassName(row.orderStatus)}`}>
                            {row.orderStatus}
                          </span>
                        ) : null}
                        {row.ticketStatus ? (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] ${statusClassName(row.ticketStatus)}`}>
                            {row.ticketStatus}
                          </span>
                        ) : null}
                        {!row.orderStatus && !row.ticketStatus && row.paymentStatus ? (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] ${statusClassName(row.paymentStatus)}`}>
                            {row.paymentStatus}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} text-[11px] font-medium text-white`}>{formatCurrency(row.total)}</td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'}`}>
                      {row.blockers.length === 0 ? (
                        <span className="text-[10px] text-emerald-300">Clear</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.blockers.slice(0, 2).map((blocker) => (
                            <span
                              key={`${row.id}-${blocker}`}
                              className="inline-flex items-center px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-300"
                            >
                              {blockerLabels[blocker]}
                            </span>
                          ))}
                          {row.blockers.length > 2 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-white/10 bg-white/10 text-[10px] text-white/65">
                              +{row.blockers.length - 2}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'}`} onClick={(event) => event.stopPropagation()}>
                      <button
                        onClick={() => onRunNextAction(row)}
                        className="h-7 px-2 rounded-md border border-[#FF3131]/40 bg-[#FF3131]/10 text-[10px] uppercase tracking-[0.12em] text-[#ff8080] hover:text-white hover:bg-[#FF3131]/20"
                      >
                        {nextActionLabels[row.nextAction]}
                      </button>
                    </td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} text-[10px] text-white/65`}>{row.assignedToName || 'Unassigned'}</td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} text-right`} onClick={(event) => event.stopPropagation()}>
                      {row.canPurchaseLabel && row.orderId ? (
                        <button
                          onClick={() => onPurchaseSingleLabel(row.orderId as string)}
                          className="h-7 px-2 rounded-md border border-white/10 text-[10px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                        >
                          Label
                        </button>
                      ) : (
                        <button
                          onClick={() => onSelectRow(row)}
                          className="h-7 px-2 rounded-md border border-white/10 text-[10px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                        >
                          Inspect
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <footer className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
        <p className="text-xs text-white/45">
          Page {pagination.page} of {pagination.pages} • {pagination.total} total
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevPage}
            disabled={pagination.page <= 1}
            className="h-8 w-8 rounded-md border border-white/10 text-white/65 hover:text-white hover:bg-white/10 disabled:opacity-40"
          >
            <CaretLeft className="w-4 h-4 mx-auto" />
          </button>
          <button
            onClick={onNextPage}
            disabled={pagination.page >= pagination.pages}
            className="h-8 w-8 rounded-md border border-white/10 text-white/65 hover:text-white hover:bg-white/10 disabled:opacity-40"
          >
            <CaretRight className="w-4 h-4 mx-auto" />
          </button>
        </div>
      </footer>
    </section>
  )
}
