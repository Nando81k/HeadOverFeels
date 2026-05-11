'use client'

import { useRef, useState } from 'react'
import { ArrowsClockwise, FunnelSimple, Gear, X } from '@phosphor-icons/react'
import type {
  FulfillmentAgeBucket,
  FulfillmentQueueType,
  FulfillmentSortDirection,
  FulfillmentSortField,
} from '@/lib/fulfillment/queue'
import { FulfillmentFilterPopover } from './FulfillmentFilterPopover'
import { FulfillmentFilterSheet } from './FulfillmentFilterSheet'
import { FulfillmentSettingsMenu, type OperatorPrefsLite } from './FulfillmentSettingsMenu'

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
  totalResults: number
  refreshing: boolean
  onRefresh: () => void
  onExportCsv?: () => void
  exporting?: boolean
  selectedQueueTypes: FulfillmentQueueType[]
  onToggleQueueType: (queueType: FulfillmentQueueType) => void
  queueTypeCounts: Record<FulfillmentQueueType, number>
  queueLabels: Record<FulfillmentQueueType, string>
  queueTypes: readonly FulfillmentQueueType[]
  onResetFilters: () => void
  activeFilterChips: FilterChip[]
  operatorPrefs: OperatorPrefsLite
  onChangeQuickShip: (value: boolean) => void
  onChangeDenseRows: (value: boolean) => void
  onChangeDefaultLane: (value: FulfillmentQueueType) => void
  onChangeDefaultCarrier: (value: string) => void
  onChangeDefaultService: (value: string) => void
  savedViewsSlot?: React.ReactNode
}

/**
 * Slim default state: search + saved-views row + queue-type chips + a single
 * "Filters (N)" trigger that opens a popover (desktop) or bottom sheet
 * (mobile). All advanced inputs live inside that overlay so the page is calm
 * by default. Active-filter chips render below when something is applied.
 */
export function FulfillmentCommandBar({
  searchInput,
  onSearchChange,
  totalResults,
  refreshing,
  onRefresh,
  onExportCsv,
  exporting = false,
  selectedQueueTypes,
  onToggleQueueType,
  queueTypeCounts,
  queueLabels,
  queueTypes,
  onResetFilters,
  activeFilterChips,
  operatorPrefs,
  onChangeQuickShip,
  onChangeDenseRows,
  onChangeDefaultLane,
  onChangeDefaultCarrier,
  onChangeDefaultService,
  savedViewsSlot,
  ...filterFormProps
}: FulfillmentCommandBarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const filterTriggerRef = useRef<HTMLButtonElement>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)
  const visibleChips = activeFilterChips.slice(0, 6)
  const hiddenChipCount = Math.max(0, activeFilterChips.length - visibleChips.length)
  const filterCount = activeFilterChips.length

  return (
    <section className="space-y-2">
      {/* Top row — search + actions. Stacks on mobile, single row on md+. */}
      <div className="rounded-xl border border-white/10 bg-neutral-900/80 p-3 flex flex-col md:flex-row md:items-center gap-2">
        <div className="flex-1 min-w-0">
          <input
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search order #, ticket #, customer, email…"
            className="w-full h-10 px-3 rounded-lg border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#FF3131]/50"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="hidden md:inline-flex items-center px-2.5 h-9 rounded-md border border-white/10 bg-white/5 text-[11px] tabular-nums text-white/65">
            {totalResults}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh queue"
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10"
          >
            <ArrowsClockwise className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative">
            <button
              ref={settingsTriggerRef}
              type="button"
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              aria-label="Open settings"
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10"
            >
              <Gear className="w-4 h-4" />
            </button>
            <FulfillmentSettingsMenu
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              anchorRef={settingsTriggerRef}
              operatorPrefs={operatorPrefs}
              onChangeQuickShip={onChangeQuickShip}
              onChangeDenseRows={onChangeDenseRows}
              onChangeDefaultLane={onChangeDefaultLane}
              onChangeDefaultCarrier={onChangeDefaultCarrier}
              onChangeDefaultService={onChangeDefaultService}
              queueLabels={queueLabels}
              queueTypes={queueTypes}
            />
          </div>
          <div className="relative">
            <button
              ref={filterTriggerRef}
              type="button"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className={`h-9 px-3 inline-flex items-center gap-1.5 rounded-md border text-[11px] uppercase tracking-[0.12em] transition-colors ${
                filterCount > 0
                  ? 'border-[#FF3131]/50 bg-[#FF3131]/15 text-white'
                  : 'border-white/10 bg-white/5 text-white/75 hover:text-white hover:bg-white/10'
              }`}
            >
              <FunnelSimple className="w-3.5 h-3.5" weight="bold" />
              <span>Filters</span>
              {filterCount > 0 ? (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3131] text-[10px] font-bold text-white tabular-nums">
                  {filterCount}
                </span>
              ) : null}
            </button>
            {/* Desktop popover — md+ only */}
            <div className="hidden md:block">
              <FulfillmentFilterPopover
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                anchorRef={filterTriggerRef}
                onResetFilters={onResetFilters}
                {...filterFormProps}
              />
            </div>
          </div>
          {onExportCsv ? (
            <button
              type="button"
              onClick={onExportCsv}
              disabled={exporting}
              className="h-9 px-3 hidden md:inline-flex items-center rounded-md border border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10 disabled:opacity-50"
            >
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Saved views row — host page provides the content. */}
      {savedViewsSlot}

      {/* Queue-type chips — kept inline because they're the primary triage axis. */}
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
        <span className="md:hidden ml-auto text-[11px] tabular-nums text-white/55">{totalResults} results</span>
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
          <button
            type="button"
            onClick={onResetFilters}
            className="ml-auto text-[11px] uppercase tracking-[0.12em] text-white/55 hover:text-white"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {/* Mobile filter sheet — sm only. Lives outside the relative trigger so it can fixed-position. */}
      <div className="md:hidden">
        <FulfillmentFilterSheet
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          onResetFilters={onResetFilters}
          {...filterFormProps}
        />
      </div>
    </section>
  )
}
