'use client'

import { X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'

export interface BulkAction {
  /** Unique key for the action — used for the React key + as a label fallback. */
  key: string
  /** Visible button label. */
  label: string
  /** Optional icon rendered before the label. */
  icon?: ReactNode
  /** Click handler — receives nothing; the parent already knows the selection. */
  onClick: () => void | Promise<void>
  /** Disable the action button. */
  disabled?: boolean
  /**
   * Visual tone:
   * - `default`: neutral white-on-translucent
   * - `primary`: solid white background (positive action)
   * - `danger`: red-tinged (destructive/cautionary)
   */
  tone?: 'default' | 'primary' | 'danger'
  /** Mark the action as currently in-flight (shows reduced opacity). */
  loading?: boolean
}

interface BulkActionToolbarProps {
  /** How many items are currently selected. The toolbar hides itself when 0. */
  selectedCount: number
  /** Singular noun for the selection (e.g. "review", "redemption"). */
  itemNoun: string
  /** Available actions for the current selection. */
  actions: BulkAction[]
  /** Clears the current selection. */
  onClear: () => void
}

/**
 * Floating sticky action bar that appears when one or more rows are selected.
 *
 * Render this at the top of any list page that supports multi-select. The
 * parent owns the selection state and the actions; this component only
 * handles presentation + animation.
 *
 * The bar is sticky so it stays in view while the user scrolls a long list.
 *
 * Example:
 * ```tsx
 * const [selected, setSelected] = useState<Set<string>>(new Set())
 *
 * <BulkActionToolbar
 *   selectedCount={selected.size}
 *   itemNoun="review"
 *   onClear={() => setSelected(new Set())}
 *   actions={[
 *     { key: 'approve', label: 'Approve', tone: 'primary', onClick: handleBulkApprove },
 *     { key: 'reject', label: 'Reject', tone: 'danger', onClick: handleBulkReject },
 *   ]}
 * />
 * ```
 */
export function BulkActionToolbar({
  selectedCount,
  itemNoun,
  actions,
  onClear,
}: BulkActionToolbarProps) {
  const visible = selectedCount > 0

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="sticky top-14 sm:top-16 z-20 mb-4"
        >
          <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-black border border-white/15 shadow-lg shadow-black/50">
            {/* Left — count + clear */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear selection"
                className="flex items-center justify-center w-7 h-7 text-white/55 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X size={13} weight="bold" />
              </button>
              <p className="text-xs sm:text-sm font-bold text-white truncate">
                {selectedCount} {selectedCount === 1 ? itemNoun : `${itemNoun}s`} selected
              </p>
            </div>

            {/* Right — actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {actions.map((action) => {
                const tone = action.tone ?? 'default'
                const base =
                  'inline-flex items-center gap-1.5 px-3 sm:px-3.5 h-8 sm:h-9 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                const toneClass =
                  tone === 'primary'
                    ? 'bg-white text-black hover:bg-white/90'
                    : tone === 'danger'
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                      : 'bg-white/10 text-white hover:bg-white/15 border border-white/15'

                return (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled || action.loading}
                    className={`${base} ${toneClass} ${action.loading ? 'opacity-60' : ''}`}
                  >
                    {action.icon}
                    <span>{action.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
