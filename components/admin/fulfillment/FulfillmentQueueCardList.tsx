'use client'

import { CheckSquare, Square } from '@phosphor-icons/react'
import type {
  FulfillmentBlocker,
  FulfillmentNextAction,
  FulfillmentQueueType,
} from '@/lib/fulfillment/queue'
import type { FulfillmentQueueRowViewModel } from '@/lib/fulfillment/console'

interface FulfillmentQueueCardListProps {
  loading: boolean
  rows: FulfillmentQueueRowViewModel[]
  activeRowId: string | null
  onSelectRow: (row: FulfillmentQueueRowViewModel) => void
  selectedOrderIds: Set<string>
  onToggleSelectOrder: (orderId: string) => void
  onPurchaseSingleLabel: (orderId: string) => void
  onMarkShippedRow?: (orderId: string) => void
  onPrintLastLabel?: () => void
  lastLabelAvailable?: boolean
  onRunNextAction: (row: FulfillmentQueueRowViewModel) => void
  queueLabels: Record<FulfillmentQueueType, string>
  nextActionLabels: Record<FulfillmentNextAction, string>
  blockerLabels: Record<FulfillmentBlocker, string>
  statusClassName: (status: string | null | undefined) => string
  formatCurrency: (amount: number | null | undefined) => string
}

/**
 * Mobile card list rendering of the fulfillment queue.
 *
 * Each card shows the same data the desktop table row carries — order/ticket
 * code, customer, age, status badges, blockers, total — but stacked
 * vertically and tap-friendly. Action buttons (next action, label, ship,
 * print, inspect) are inline at the bottom of the card. The select-row
 * checkbox lives in the top-right corner so it's reachable with the thumb.
 */
export function FulfillmentQueueCardList({
  loading,
  rows,
  activeRowId,
  onSelectRow,
  selectedOrderIds,
  onToggleSelectOrder,
  onPurchaseSingleLabel,
  onMarkShippedRow,
  onPrintLastLabel,
  lastLabelAvailable = false,
  onRunNextAction,
  queueLabels,
  nextActionLabels,
  blockerLabels,
  statusClassName,
  formatCurrency,
}: FulfillmentQueueCardListProps) {
  if (loading) {
    return <div className="px-4 py-12 text-center text-white/45 text-sm">Loading queue…</div>
  }

  if (rows.length === 0) {
    return <div className="px-4 py-12 text-center text-white/45 text-sm">No queue items match current filters.</div>
  }

  return (
    <ul className="divide-y divide-white/10">
      {rows.map((row) => {
        const isActive = row.id === activeRowId
        const selected = row.orderId ? selectedOrderIds.has(row.orderId) : false
        const recordCode = row.orderNumber || row.ticketNumber || 'Record'
        const lane = queueLabels[row.queueType as FulfillmentQueueType] || row.laneLabel
        const canShip =
          onMarkShippedRow && row.orderId && row.orderStatus && row.orderStatus !== 'SHIPPED' && row.orderStatus !== 'DELIVERED'
        return (
          <li
            key={row.id}
            className={`px-4 py-3 ${isActive ? 'bg-white/10' : 'active:bg-white/5'} transition-colors`}
          >
            <button
              type="button"
              onClick={() => onSelectRow(row)}
              className="block w-full text-left"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{recordCode}</p>
                  {row.ticketSubject ? (
                    <p className="text-[11px] text-white/55 truncate">{row.ticketSubject}</p>
                  ) : null}
                </div>
                <p className="text-sm font-bold text-white tabular-nums shrink-0">{formatCurrency(row.total)}</p>
              </div>
              <p className="text-[12px] text-white truncate">{row.customerName}</p>
              <p className="text-[11px] text-white/45 truncate mb-2">{row.customerEmail}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/80">
                  {lane}
                </span>
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
                <span className="text-[11px] text-white/55">{row.ageHours}h old</span>
                {row.blockers.length > 0 ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-300">
                    {row.blockers.length === 1 ? blockerLabels[row.blockers[0]] : `${row.blockers.length} blockers`}
                  </span>
                ) : null}
              </div>
            </button>

            <div className="mt-3 flex items-center gap-1.5">
              {row.orderId ? (
                <button
                  type="button"
                  onClick={() => onToggleSelectOrder(row.orderId as string)}
                  aria-label={selected ? 'Deselect for batch' : 'Select for batch'}
                  className={`h-9 w-9 inline-flex items-center justify-center rounded-md border transition-colors ${
                    selected ? 'border-[#FF3131]/50 bg-[#FF3131]/15 text-white' : 'border-white/10 bg-white/5 text-white/55 hover:text-white'
                  }`}
                >
                  {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onRunNextAction(row)}
                className="h-9 px-3 rounded-md border border-[#FF3131]/40 bg-[#FF3131]/10 text-[10px] font-bold uppercase tracking-[0.12em] text-[#ff8080] hover:text-white hover:bg-[#FF3131]/20"
              >
                {nextActionLabels[row.nextAction]}
              </button>
              {row.canPurchaseLabel && row.orderId ? (
                <button
                  type="button"
                  onClick={() => onPurchaseSingleLabel(row.orderId as string)}
                  className="h-9 px-3 rounded-md border border-white/10 text-[10px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                >
                  Label
                </button>
              ) : null}
              {canShip ? (
                <button
                  type="button"
                  onClick={() => onMarkShippedRow!(row.orderId as string)}
                  className="h-9 px-3 rounded-md border border-white/10 text-[10px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                >
                  Ship
                </button>
              ) : null}
              {onPrintLastLabel && lastLabelAvailable ? (
                <button
                  type="button"
                  onClick={onPrintLastLabel}
                  className="h-9 px-3 rounded-md border border-white/10 text-[10px] uppercase tracking-[0.12em] text-white/70 hover:text-white hover:bg-white/10"
                >
                  Print
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
