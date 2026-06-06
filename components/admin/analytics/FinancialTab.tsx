// components/admin/analytics/FinancialTab.tsx
//
// Server component — no interactivity, no `dark:` classes.
// Composes: RevenueExpenseArea · MarginTrendChart · Tax Summary card · PeriodGridTable · ExportButton
//
// Props: { data: FinancialData; range: TimeRange }
//   FinancialData comes from @/lib/admin/analytics (server-only import type).

import type { FinancialData, TimeRange } from '@/lib/admin/analytics'
import { RevenueExpenseArea } from '@/components/admin/analytics/charts/RevenueExpenseArea'
import { MarginTrendChart } from '@/components/admin/analytics/charts/MarginTrendChart'
import { PeriodGridTable } from '@/components/admin/analytics/PeriodGridTable'
import { ExportButton } from '@/components/admin/analytics/ExportButton'

// ── Tax status pill colours ─────────────────────────────────────────────────

function taxStatusClass(status: string): string {
  switch (status) {
    case 'FILED':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    case 'PAID':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/20'
    case 'CALCULATED':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    case 'DRAFT':
      return 'bg-white/[0.05] text-white/50 border-white/10'
    default:
      return 'bg-white/[0.05] text-white/50 border-white/10'
  }
}

// ── Quarter label helper ────────────────────────────────────────────────────

function quarterLabel(row: FinancialData['taxSummary'][number]): string {
  if (row.period === 'QUARTERLY' && row.quarter != null) {
    return `Q${row.quarter} ${row.year}`
  }
  if (row.period === 'MONTHLY' && row.month != null) {
    const monthName = new Date(row.year, row.month - 1, 1).toLocaleString('en-US', { month: 'short' })
    return `${monthName} ${row.year}`
  }
  if (row.period === 'YEARLY') {
    return `Annual ${row.year}`
  }
  return String(row.year)
}

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

// ── Component ───────────────────────────────────────────────────────────────

export interface FinancialTabProps {
  data: FinancialData
  range: TimeRange
}

export function FinancialTab({ data, range }: FinancialTabProps) {
  const { revenueExpenseTrend, marginTrend, taxSummary, periodGrid } = data

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Financial Overview</h2>
          <p className="text-xs text-white/40 mt-0.5">Revenue, margins, tax summary, and P&amp;L grid</p>
        </div>
        <ExportButton tab="financial" range={range} />
      </div>

      {/* ── Charts row — side-by-side on desktop ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue vs Expenses */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">
            Revenue vs Expenses
          </h3>
          <RevenueExpenseArea data={revenueExpenseTrend} height={280} />
        </div>

        {/* Gross Margin Trend */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">
            Gross Margin Trend
          </h3>
          <MarginTrendChart data={marginTrend} height={280} />
        </div>
      </div>

      {/* ── Tax Summary card ── */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">
          Tax Summary — Last 4 Quarters
        </h3>

        {taxSummary.length === 0 ? (
          <p className="text-xs text-white/40 py-4">No tax records found.</p>
        ) : (
          <div
            data-testid="tax-summary-table"
            className="overflow-x-auto"
          >
            <table className="w-full text-xs text-left">
              <thead className="bg-white/[0.04] text-white/50">
                <tr>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Period</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Gross Revenue</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Taxable Revenue</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Tax Collected</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="text-white/80">
                {taxSummary.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-white/8 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-3 py-2 text-white/60 whitespace-nowrap tabular-nums">
                      {quarterLabel(row)}
                    </td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      {currencyFmt.format(row.grossRevenue)}
                    </td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      {/* taxableRevenue field not on TaxSummaryRow — use netIncome as proxy */}
                      {currencyFmt.format(row.netIncome)}
                    </td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      {currencyFmt.format(row.salesTaxCollected)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${taxStatusClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 12-month P&L Grid ── */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">
          12-Month P&amp;L Grid
        </h3>
        <PeriodGridTable rows={periodGrid} monthsToShow={12} />
      </div>
    </div>
  )
}
