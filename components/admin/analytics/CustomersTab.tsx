'use client'

/**
 * CustomersTab — Phase 6 Task 23
 *
 * Composes:
 *  - CustomerAcquisitionChart  (acquisitionTrend)
 *  - MarginScatter as LTV scatter  (ltvScatter, xLabel="Total Spent", yLabel="Orders")
 *  - CohortTable  (cohort cells — prop name is `cells`, field is `orderBucket`)
 *  - Paginated customer table — rows click to open CustomerInspector
 *  - CustomerInspector — loads full detail via getCustomerDetailForInspector server action
 *  - ExportButton in header (tab='customers')
 *
 * Props: { data: CustomersData; range: TimeRange }
 * State: inspectorOpen + inspectorDetail for the slide-out inspector.
 */

import { useState, useTransition } from 'react'
import type { CustomersData, CustomerTableRow, TimeRange } from '@/lib/admin/analytics'
import type { CustomerDetailFull } from '@/app/admin/analytics/actions'
import { getCustomerDetailForInspector } from '@/app/admin/analytics/actions'
import { CustomerAcquisitionChart } from '@/components/admin/analytics/charts/CustomerAcquisitionChart'
import { MarginScatter } from '@/components/admin/analytics/charts/MarginScatter'
import { CohortTable } from '@/components/admin/analytics/CohortTable'
import { CustomerInspector } from '@/components/admin/analytics/inspectors/CustomerInspector'
import { ExportButton } from '@/components/admin/analytics/ExportButton'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CustomersTabProps {
  data: CustomersData
  range: TimeRange
}

// ─── Currency formatter ───────────────────────────────────────────────────────

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] uppercase tracking-widest text-white/40 mb-3">{children}</h3>
  )
}

// ─── Pagination controls ──────────────────────────────────────────────────────

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
}

function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-3 px-1">
      <span className="text-xs text-white/40">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-2 py-1 rounded text-xs text-white/60 hover:text-white disabled:opacity-30 bg-white/[0.04] border border-white/8"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-2 py-1 rounded text-xs text-white/60 hover:text-white disabled:opacity-30 bg-white/[0.04] border border-white/8"
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ─── Customer table row ───────────────────────────────────────────────────────

interface CustomerRowProps {
  row: CustomerTableRow
  onClick: () => void
}

function CustomerRowItem({ row, onClick }: CustomerRowProps) {
  return (
    <tr
      onClick={onClick}
      className="border-t border-white/[0.05] hover:bg-white/[0.03] cursor-pointer transition-colors"
    >
      <td className="px-3 py-2">
        <div className="text-sm text-white leading-snug">{row.email}</div>
        {row.name && <div className="text-xs text-white/40">{row.name}</div>}
      </td>
      <td className="px-3 py-2 text-xs text-white/70 whitespace-nowrap">
        {formatDate(row.createdAt)}
      </td>
      <td className="px-3 py-2 text-xs text-white text-right whitespace-nowrap">
        {currency.format(row.totalSpent)}
      </td>
      <td className="px-3 py-2 text-xs text-white/70 text-right whitespace-nowrap">
        {row.totalOrders}
      </td>
      <td className="px-3 py-2 text-xs text-white/70 text-right whitespace-nowrap">
        {currency.format(row.avgOrderValue)}
      </td>
      <td className="px-3 py-2 text-xs text-white/50 whitespace-nowrap">
        {row.loyaltyTierName ?? '—'}
      </td>
      <td className="px-3 py-2 text-xs text-white/40 whitespace-nowrap">
        {formatDate(row.lastOrderDate)}
      </td>
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CustomersTab({ data, range }: CustomersTabProps) {
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorDetail, setInspectorDetail] = useState<CustomerDetailFull | null>(null)
  const [tablePage, setTablePage] = useState(1)
  const [, startTransition] = useTransition()

  const handleRowClick = (customerId: string) => {
    setInspectorOpen(true)
    setInspectorDetail(null) // show loading state
    startTransition(async () => {
      const detail = await getCustomerDetailForInspector(customerId)
      setInspectorDetail(detail)
    })
  }

  const handleCloseInspector = () => {
    setInspectorOpen(false)
    setInspectorDetail(null)
  }

  // Client-side slice for table pages (data already paginated server-side,
  // but page state is kept local so the parent doesn't need to re-fetch on page changes).
  const tableItems = data.table.items

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/80">Customers</h2>
        <ExportButton tab="customers" range={range} />
      </div>

      {/* ── Acquisition trend ── */}
      <section>
        <SectionHeading>Customer Acquisition</SectionHeading>
        <div className="bg-neutral-900/60 border border-white/[0.06] rounded-xl p-4">
          <CustomerAcquisitionChart data={data.acquisitionTrend} height={260} />
        </div>
      </section>

      {/* ── LTV Scatter + Cohort side by side on wide screens ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* LTV Scatter */}
        <section>
          <SectionHeading>Lifetime Value Scatter</SectionHeading>
          <div className="bg-neutral-900/60 border border-white/[0.06] rounded-xl p-4">
            <MarginScatter
              data={data.ltvScatter}
              height={260}
              xLabel="Total Spent"
              yLabel="Orders"
            />
          </div>
        </section>

        {/* Cohort table */}
        <section>
          <SectionHeading>Retention Cohort</SectionHeading>
          <div className="bg-neutral-900/60 border border-white/[0.06] rounded-xl p-4">
            <CohortTable cells={data.cohort} monthsToShow={6} />
          </div>
        </section>
      </div>

      {/* ── Customer table ── */}
      <section>
        <SectionHeading>All Customers</SectionHeading>
        <div className="bg-neutral-900/60 border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.04] text-white/40">
                <tr>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Signed up</th>
                  <th className="px-3 py-2 font-medium text-right">Lifetime spend</th>
                  <th className="px-3 py-2 font-medium text-right">Orders</th>
                  <th className="px-3 py-2 font-medium text-right">AOV</th>
                  <th className="px-3 py-2 font-medium">Tier</th>
                  <th className="px-3 py-2 font-medium">Last order</th>
                </tr>
              </thead>
              <tbody>
                {tableItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-white/30"
                    >
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  tableItems.map((row) => (
                    <CustomerRowItem
                      key={row.id}
                      row={row}
                      onClick={() => handleRowClick(row.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-3 pb-3">
            <Pagination
              page={tablePage}
              pageSize={data.table.pageSize}
              total={data.table.total}
              onPageChange={setTablePage}
            />
          </div>
        </div>
      </section>

      {/* ── Customer Inspector ── */}
      <CustomerInspector
        open={inspectorOpen}
        detail={inspectorDetail}
        onClose={handleCloseInspector}
      />
    </div>
  )
}
