'use client'

// Local type declarations — do NOT import from @/lib/admin/analytics to avoid
// Prisma type leaking into the client bundle (cross-cutting note #1).
export interface FinancialSnapshotRow {
  id: string
  date: Date
  periodType: string
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  totalCOGS: number
  totalExpenses: number
  grossProfit: number
  grossMargin: number
  netProfit: number
  netMargin: number
  salesTaxCollected: number
  inventoryValue: number
  cashOnHand: number | null
}

export interface PeriodGridTableProps {
  /** null = loading skeleton, [] = empty state */
  rows: FinancialSnapshotRow[] | null
  /** How many months to display at most (default: 12) */
  monthsToShow?: number
}

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function dash(n: number): string {
  return n === 0 ? '—' : currencyFmt.format(n)
}

function dashPct(n: number): string {
  return n === 0 ? '—' : `${n.toFixed(1)}%`
}

function isoMonth(d: Date): string {
  // Returns "YYYY-MM" — stable across timezones when Date is UTC midnight
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const SKELETON_ROWS = 8

export function PeriodGridTable({ rows, monthsToShow = 12 }: PeriodGridTableProps) {
  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (rows === null) {
    return (
      <div
        data-testid="period-grid-skeleton"
        className="space-y-2"
        aria-hidden="true"
        aria-label="Loading period data"
      >
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div
            key={i}
            className="h-10 bg-white/[0.03] border border-white/8 rounded-md animate-pulse"
          />
        ))}
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <p className="text-xs text-white/40 py-4">
        No period data yet — backfill in progress.
      </p>
    )
  }

  // ── Data table ────────────────────────────────────────────────────────────
  const visibleRows = rows.slice(0, monthsToShow)

  return (
    <div className="overflow-x-auto border border-white/8 rounded-md">
      <table className="w-full text-xs text-left">
        <thead className="bg-white/[0.04] text-white/50">
          <tr>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Period</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Revenue</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">COGS</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Gross Profit</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Expenses</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Net Profit</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Margin %</th>
          </tr>
        </thead>
        <tbody className="text-white/80">
          {visibleRows.map((row) => (
            <tr
              key={row.id}
              className="border-t border-white/8 hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-3 py-2 text-white/60 tabular-nums whitespace-nowrap">
                {isoMonth(row.date)}
              </td>
              <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                {dash(row.totalRevenue)}
              </td>
              <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                {dash(row.totalCOGS)}
              </td>
              <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                {dash(row.grossProfit)}
              </td>
              <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                {dash(row.totalExpenses)}
              </td>
              <td
                className={`px-3 py-2 tabular-nums whitespace-nowrap ${
                  row.netProfit > 0
                    ? 'text-emerald-400'
                    : row.netProfit < 0
                    ? 'text-red-400'
                    : ''
                }`}
              >
                {dash(row.netProfit)}
              </td>
              <td
                className={`px-3 py-2 tabular-nums whitespace-nowrap ${
                  row.netMargin > 0
                    ? 'text-emerald-400'
                    : row.netMargin < 0
                    ? 'text-red-400'
                    : ''
                }`}
              >
                {dashPct(row.netMargin)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
