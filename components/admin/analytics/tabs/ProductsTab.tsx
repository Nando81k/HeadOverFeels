'use client'

import { useState, useTransition } from 'react'
import { TopProductsBar } from '@/components/admin/analytics/charts/TopProductsBar'
import { MarginScatter } from '@/components/admin/analytics/charts/MarginScatter'
import { ProductInspector } from '@/components/admin/analytics/inspectors/ProductInspector'
import { ExportButton } from '@/components/admin/analytics/ExportButton'
import {
  getProductFinancialDetailForInspector,
} from '@/app/admin/analytics/actions'
import type { ProductFinancialDetailFull, TimeRange } from '@/app/admin/analytics/actions'

// ─── Row types ────────────────────────────────────────────────────────────────

export interface ProductTableRow {
  id: string
  name: string
  unitsSold: number
  revenue: number
  cost: number
  grossMargin: number
  marginPct: number
  imageUrl: string | null
}

// ─── Tab data shape ───────────────────────────────────────────────────────────

export interface ProductsTabData {
  topProducts: { productId: string; name: string; unitsSold: number; revenue: number }[]
  marginScatter: { productId: string; name: string; price: number; marginPct: number; unitsSold: number }[]
  table: { items: ProductTableRow[]; total: number; page: number; pageSize: number }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ProductsTabProps {
  data: ProductsTabData
  range: TimeRange
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductsTab({ data, range }: ProductsTabProps) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<ProductFinancialDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openRow = (id: string) => {
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getProductFinancialDetailForInspector(id, range)
      setDetail(d)
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Header with export ── */}
      <div className="flex items-center justify-end">
        <ExportButton tab="products" range={range} />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-neutral-900/60 border border-white/[0.08] rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Top Products</h3>
          <TopProductsBar data={data.topProducts} />
        </div>
        <div className="bg-neutral-900/60 border border-white/[0.08] rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Margin Distribution</h3>
          <MarginScatter data={data.marginScatter} xLabel="Price" yLabel="Margin %" />
        </div>
      </div>

      {/* ── Paginated product table ── */}
      <div className="bg-neutral-900/60 border border-white/[0.08] rounded-md overflow-hidden">
        <h3 className="text-xs uppercase tracking-wide text-white/40 px-3 py-2 border-b border-white/[0.08]">
          Products ({data.table.total})
        </h3>
        <table className="w-full text-xs">
          <thead className="bg-white/[0.04] text-white/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Units</th>
              <th className="px-3 py-2 font-medium">Revenue</th>
              <th className="px-3 py-2 font-medium">Margin</th>
            </tr>
          </thead>
          <tbody className="text-white/80">
            {data.table.items.map((p) => (
              <tr
                key={p.id}
                className="border-t border-white/[0.08] hover:bg-white/[0.04] cursor-pointer transition-colors"
                onClick={() => openRow(p.id)}
              >
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">{p.unitsSold.toLocaleString()}</td>
                <td className="px-3 py-2">{fmt.format(p.revenue)}</td>
                <td className="px-3 py-2">{p.marginPct.toFixed(1)}%</td>
              </tr>
            ))}
            {data.table.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-white/30">
                  No products for this range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Inspector ── */}
      <ProductInspector open={open} detail={detail} onClose={() => setOpen(false)} />
    </div>
  )
}
