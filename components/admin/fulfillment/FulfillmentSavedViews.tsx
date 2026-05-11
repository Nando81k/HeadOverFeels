'use client'

import { Plus, X } from '@phosphor-icons/react'
import type {
  FulfillmentAgeBucket,
  FulfillmentQueueType,
} from '@/lib/fulfillment/queue'

export interface SavedView {
  id: string
  name: string
  builtIn?: boolean
  filters: SavedViewFilters
}

export interface SavedViewFilters {
  selectedQueueTypes: FulfillmentQueueType[]
  orderStatusFilter: string
  paymentStatusFilter: string
  ticketStatusFilter: string
  assignedFilter: 'all' | 'assigned' | 'unassigned'
  ageBucket: FulfillmentAgeBucket
  dateFrom: string
  dateTo: string
  totalMin: string
  totalMax: string
}

interface FulfillmentSavedViewsProps {
  views: SavedView[]
  activeViewId: string | null
  onApplyView: (view: SavedView) => void
  onSaveCurrent: () => void
  onDeleteView: (id: string) => void
}

/**
 * Horizontal pill row of saved filter views.
 *
 * Each pill applies a snapshot of filter state. Custom (non-built-in) views
 * have a small × to delete. The "+ Save view" button captures the current
 * filter set as a new view (host page handles the prompt + persistence).
 *
 * Scrolls horizontally on overflow so this row never wraps.
 */
export function FulfillmentSavedViews({
  views,
  activeViewId,
  onApplyView,
  onSaveCurrent,
  onDeleteView,
}: FulfillmentSavedViewsProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900/70 px-3 py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-0.5 -mb-0.5">
        {views.map((view) => {
          const active = view.id === activeViewId
          return (
            <span
              key={view.id}
              className={`inline-flex items-center rounded-md border text-[11px] uppercase tracking-[0.12em] transition-colors shrink-0 ${
                active
                  ? 'border-white bg-white text-black'
                  : 'border-white/10 text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <button
                type="button"
                onClick={() => onApplyView(view)}
                className="h-8 px-3 inline-flex items-center"
              >
                {view.name}
              </button>
              {!view.builtIn ? (
                <button
                  type="button"
                  onClick={() => onDeleteView(view.id)}
                  aria-label={`Delete view ${view.name}`}
                  className={`h-8 w-7 inline-flex items-center justify-center border-l ${
                    active ? 'border-black/20 text-black/60 hover:text-black' : 'border-white/10 text-white/40 hover:text-white'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              ) : null}
            </span>
          )
        })}
        <button
          type="button"
          onClick={onSaveCurrent}
          className="h-8 px-3 inline-flex items-center gap-1 rounded-md border border-dashed border-white/15 text-[11px] uppercase tracking-[0.12em] text-white/55 hover:text-white hover:border-white/35 shrink-0"
        >
          <Plus className="w-3 h-3" />
          Save view
        </button>
      </div>
    </div>
  )
}
