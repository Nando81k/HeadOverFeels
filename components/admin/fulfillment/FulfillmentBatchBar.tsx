'use client'

import {
  CheckSquare,
  X,
  Tag,
  Truck,
  PaperPlaneTilt,
  Printer,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface FulfillmentBatchBarProps {
  /** How many orders are currently in the batch / selected. Bar hides at 0. */
  selectedCount: number
  /** Sum of order totals across the batch — shown as a quick economic signal. */
  selectedTotal: number
  /** Subset eligible for label purchase. */
  labelableCount: number
  /** Subset eligible for "mark shipped". */
  markShippableCount: number
  /** Subset eligible for "send tracking". */
  trackingNotifiableCount: number
  /** When > 0, the most-recent batch produced labels we can re-open. */
  latestPrintCount: number
  /** Disabled while any action is mid-flight. */
  loading?: boolean
  onClear: () => void
  onPurchaseLabels: () => void
  onMarkShipped: () => void
  onSendTracking: () => void
  onPrintLabels: () => void
}

/**
 * Sticky bottom batch action bar for the fulfillment workbench.
 *
 * Replaces the top-anchored selection banner with a bar that sits at the
 * bottom of the viewport while a batch is queued. Three primary actions
 * (Buy labels / Mark shipped / Send tracking) plus a Print Labels affordance
 * once a batch has produced label PDFs. Each action button shows the
 * eligible count to reduce surprise.
 *
 * The bar is purely presentation; the page owns selection state and action
 * handlers and tells the bar what the eligible counts are.
 *
 * Example (host page):
 * ```tsx
 * <FulfillmentBatchBar
 *   selectedCount={selectedOrderIds.size}
 *   selectedTotal={selectedOrders.reduce((s, o) => s + o.total, 0)}
 *   labelableCount={selectedForLabel.length}
 *   markShippableCount={selectedForMarkShipped.length}
 *   trackingNotifiableCount={selectedForTrackingUpdate.length}
 *   latestPrintCount={latestBatchPrintUrls.length}
 *   loading={actionLoading}
 *   onClear={() => setSelectedOrderIds(new Set())}
 *   onPurchaseLabels={() => purchaseBatchLabels(selectedForLabel)}
 *   onMarkShipped={() => markShippedBatch(selectedForMarkShipped)}
 *   onSendTracking={() => sendTrackingUpdatesBatch(selectedForTrackingUpdate)}
 *   onPrintLabels={openBatchPrintUrls}
 * />
 * ```
 */
export function FulfillmentBatchBar({
  selectedCount,
  selectedTotal,
  labelableCount,
  markShippableCount,
  trackingNotifiableCount,
  latestPrintCount,
  loading = false,
  onClear,
  onPurchaseLabels,
  onMarkShipped,
  onSendTracking,
  onPrintLabels,
}: FulfillmentBatchBarProps) {
  const visible = selectedCount > 0
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(selectedTotal)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[min(calc(100vw-1.5rem),64rem)]"
        >
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-black border border-[#FF3131]/40 shadow-2xl shadow-black/60">
            {/* Left — count + clear */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear batch"
                className="flex items-center justify-center w-7 h-7 text-white/55 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X size={13} weight="bold" />
              </button>
              <CheckSquare size={14} weight="bold" className="text-[#ff6b6b] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-white truncate">
                  {selectedCount} {selectedCount === 1 ? 'order' : 'orders'}
                </p>
                <p className="text-[10px] text-white/45 tabular-nums">{formattedTotal}</p>
              </div>
            </div>

            {/* Right — actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
              <BatchActionButton
                tone="primary"
                icon={<Tag size={12} weight="bold" />}
                label="Buy labels"
                count={labelableCount}
                onClick={onPurchaseLabels}
                disabled={loading || labelableCount === 0}
              />
              <BatchActionButton
                tone="default"
                icon={<Truck size={12} weight="bold" />}
                label="Mark shipped"
                count={markShippableCount}
                onClick={onMarkShipped}
                disabled={loading || markShippableCount === 0}
              />
              <BatchActionButton
                tone="default"
                icon={<PaperPlaneTilt size={12} weight="bold" />}
                label="Send tracking"
                count={trackingNotifiableCount}
                onClick={onSendTracking}
                disabled={loading || trackingNotifiableCount === 0}
              />
              {latestPrintCount > 0 && (
                <BatchActionButton
                  tone="default"
                  icon={<Printer size={12} weight="bold" />}
                  label="Print"
                  count={latestPrintCount}
                  onClick={onPrintLabels}
                  disabled={loading}
                />
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface BatchActionButtonProps {
  tone: 'primary' | 'default'
  icon: React.ReactNode
  label: string
  count: number
  onClick: () => void
  disabled?: boolean
}

function BatchActionButton({ tone, icon, label, count, onClick, disabled }: BatchActionButtonProps) {
  const base =
    'inline-flex items-center gap-1.5 px-2.5 sm:px-3 h-8 sm:h-9 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const toneClass =
    tone === 'primary'
      ? 'bg-[#FF3131] text-white hover:bg-[#ff4747]'
      : 'border border-white/15 text-white/85 hover:text-white hover:bg-white/10'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${toneClass}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="text-white/55 tabular-nums">({count})</span>
    </button>
  )
}
