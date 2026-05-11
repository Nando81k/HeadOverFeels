'use client'

import {
  CaretLeft,
  CaretRight,
  CheckSquare,
  Printer,
  Square,
  Tag,
  Truck,
} from '@phosphor-icons/react'
import type {
  FulfillmentBlocker,
  FulfillmentNextAction,
  FulfillmentQueueType,
} from '@/lib/fulfillment/queue'
import type { FulfillmentQueueRowViewModel } from '@/lib/fulfillment/console'
import { FulfillmentQueueCardList } from './FulfillmentQueueCardList'

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
  onMarkShippedRow?: (orderId: string) => void
  onPrintLastLabel?: () => void
  lastLabelAvailable?: boolean
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
  onMarkShippedRow,
  onPrintLastLabel,
  lastLabelAvailable = false,
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
        {/* Mobile card list */}
        <div className="md:hidden">
          <FulfillmentQueueCardList
            loading={loading}
            rows={rows}
            activeRowId={activeRowId}
            onSelectRow={onSelectRow}
            selectedOrderIds={selectedOrderIds}
            onToggleSelectOrder={onToggleSelectOrder}
            onPurchaseSingleLabel={onPurchaseSingleLabel}
            onMarkShippedRow={onMarkShippedRow}
            onPrintLastLabel={onPrintLastLabel}
            lastLabelAvailable={lastLabelAvailable}
            onRunNextAction={onRunNextAction}
            queueLabels={queueLabels}
            nextActionLabels={nextActionLabels}
            blockerLabels={blockerLabels}
            statusClassName={statusClassName}
            formatCurrency={formatCurrency}
          />
        </div>

        {/* Desktop table — md+ only */}
        <div className="hidden md:block">
        {loading ? (
          <div className="px-4 py-12 text-center text-white/45">Loading queue...</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-white/45">No queue items match current filters.</div>
        ) : (
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-10" />
              <col className="w-24" />
              <col className="w-[17%]" />
              <col className="w-[17%]" />
              <col className="w-16" />
              <col className="w-[10%]" />
              <col className="w-[88px]" />
              <col className="w-[12%]" />
              <col className="w-28" />
              <col className="w-[11%]" />
              <col className="w-[148px]" />
            </colgroup>
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
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-right text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Age
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Status
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-right text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Total
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Blockers
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Next action
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Owner
                </th>
                <th className="sticky top-0 z-10 bg-neutral-950 px-3 py-2 text-right text-[10px] uppercase tracking-[0.12em] text-white/40">
                  Actions
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
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} align-middle`} onClick={(event) => event.stopPropagation()}>
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
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} align-middle`}>
                      <span className="inline-flex items-center max-w-full rounded border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/80 truncate">
                        {queueLabels[row.queueType as FulfillmentQueueType] || row.laneLabel}
                      </span>
                    </td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} align-middle min-w-0`}>
                      <p className="text-[11px] font-semibold text-white truncate">{recordCode}</p>
                      {row.ticketSubject ? <p className="text-[10px] text-white/45 truncate">{row.ticketSubject}</p> : null}
                    </td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} align-middle min-w-0`}>
                      <p className="text-[11px] text-white truncate">{row.customerName}</p>
                      <p className="text-[10px] text-white/45 truncate">{row.customerEmail}</p>
                    </td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} align-middle text-right text-[11px] tabular-nums text-white/65 whitespace-nowrap`}>{row.ageHours}h</td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} align-middle min-w-0`}>
                      <div className="flex items-center gap-1 min-w-0">
                        {row.orderStatus ? (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] truncate max-w-full ${statusClassName(row.orderStatus)}`}>
                            {row.orderStatus}
                          </span>
                        ) : row.ticketStatus ? (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] truncate max-w-full ${statusClassName(row.ticketStatus)}`}>
                            {row.ticketStatus}
                          </span>
                        ) : row.paymentStatus ? (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] truncate max-w-full ${statusClassName(row.paymentStatus)}`}>
                            {row.paymentStatus}
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/35">—</span>
                        )}
                      </div>
                    </td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} align-middle text-right text-[11px] font-medium text-white tabular-nums whitespace-nowrap`}>{formatCurrency(row.total)}</td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} align-middle min-w-0`}>
                      {row.blockers.length === 0 ? (
                        <span className="text-[10px] text-emerald-300">Clear</span>
                      ) : (
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-300 truncate max-w-full"
                            title={row.blockers.map((blocker) => blockerLabels[blocker]).join(', ')}
                          >
                            {blockerLabels[row.blockers[0]]}
                          </span>
                          {row.blockers.length > 1 ? (
                            <span className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded border border-white/10 bg-white/10 text-[10px] text-white/65">
                              +{row.blockers.length - 1}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} align-middle`} onClick={(event) => event.stopPropagation()}>
                      <button
                        onClick={() => onRunNextAction(row)}
                        className="inline-flex items-center max-w-full h-7 px-2 rounded-md border border-[#FF3131]/40 bg-[#FF3131]/10 text-[10px] uppercase tracking-[0.12em] text-[#ff8080] hover:text-white hover:bg-[#FF3131]/20 truncate"
                      >
                        <span className="truncate">{nextActionLabels[row.nextAction]}</span>
                      </button>
                    </td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} align-middle text-[10px] text-white/65 truncate`}>{row.assignedToName || 'Unassigned'}</td>
                    <td className={`px-3 ${dense ? 'py-2' : 'py-2.5'} align-middle text-right`} onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {row.canPurchaseLabel && row.orderId ? (
                          <button
                            onClick={() => onPurchaseSingleLabel(row.orderId as string)}
                            aria-label="Buy label"
                            title="Buy label"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                        {onMarkShippedRow && row.orderId && row.orderStatus && row.orderStatus !== 'SHIPPED' && row.orderStatus !== 'DELIVERED' ? (
                          <button
                            onClick={() => onMarkShippedRow(row.orderId as string)}
                            aria-label="Mark shipped"
                            title="Mark shipped"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                          >
                            <Truck className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                        {onPrintLastLabel && lastLabelAvailable ? (
                          <button
                            onClick={onPrintLastLabel}
                            aria-label="Re-open last printed label"
                            title="Re-open last printed label"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                        <button
                          onClick={() => onSelectRow(row)}
                          className="h-7 px-2 rounded-md border border-white/10 text-[10px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                        >
                          Inspect
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        </div>
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
