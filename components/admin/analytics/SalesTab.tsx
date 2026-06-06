'use client'

/**
 * SalesTab — Phase 6 Wave 4, Task 22
 *
 * Layout:
 *   Desktop (sm+): 2-column grid — main column (RevenueTrendChart + TopProductsBar)
 *                  and sidebar column (LiveFeedSidebar, always expanded).
 *   Mobile: single column; LiveFeedSidebar renders its own internal accordion toggle.
 *
 * Props: { data: SalesData; range: TimeRange }
 * ExportButton tab='sales' lives in the section header.
 */

import type { SalesData, TimeRange } from '@/lib/admin/analytics'
import { RevenueTrendChart } from '@/components/admin/analytics/charts/RevenueTrendChart'
import { TopProductsBar } from '@/components/admin/analytics/charts/TopProductsBar'
import { LiveFeedSidebar } from '@/components/admin/analytics/LiveFeedSidebar'
import { ExportButton } from '@/components/admin/analytics/ExportButton'

export interface SalesTabProps {
  data: SalesData
  range: TimeRange
}

export function SalesTab({ data, range }: SalesTabProps) {
  const { revenueTrend, topProducts } = data

  return (
    <section data-testid="sales-tab" className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-white/60 uppercase">
          Sales
        </h2>
        <ExportButton tab="sales" range={range} />
      </div>

      {/* 2-col grid on sm+; single col on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_280px] gap-4">
        {/* Main column */}
        <div className="space-y-4">
          {/* Revenue trend chart */}
          <div
            data-testid="sales-revenue-panel"
            className="bg-neutral-900/60 border border-white/8 rounded-md p-3"
          >
            <p className="text-[11px] font-medium tracking-wide text-white/40 uppercase mb-2">
              Revenue Trend
            </p>
            <RevenueTrendChart data={revenueTrend} height={260} />
          </div>

          {/* Top products bar */}
          <div
            data-testid="sales-top-products-panel"
            className="bg-neutral-900/60 border border-white/8 rounded-md p-3"
          >
            <p className="text-[11px] font-medium tracking-wide text-white/40 uppercase mb-2">
              Top Products
            </p>
            <TopProductsBar data={topProducts} height={260} />
          </div>
        </div>

        {/* Sidebar column — LiveFeedSidebar handles its own mobile accordion */}
        <div data-testid="sales-live-feed-panel">
          <LiveFeedSidebar />
        </div>
      </div>
    </section>
  )
}
