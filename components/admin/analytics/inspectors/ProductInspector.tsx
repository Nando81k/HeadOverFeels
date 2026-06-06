'use client'

/**
 * ProductInspector — read-only slide-out financial summary for a top-selling product.
 *
 * Scope (Phase 6 Task 16):
 *  - Displays: name, image thumbnail, base price, units sold (in range),
 *    revenue, cost, gross margin (value + %), date window.
 *  - "Open product details →" link to /admin/products/${id}.
 *  - Fully read-only — no mutations.
 */

import Link from 'next/link'
import { Inspector } from '@/components/ui/Inspector'
import type { ProductFinancialDetailFull } from '@/app/admin/analytics/actions'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ProductInspectorProps {
  open: boolean
  detail: ProductFinancialDetailFull | null
  onClose: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Stat cell ───────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-900/60 border border-white/[0.08] rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{label}</p>
      <p className="text-sm font-medium text-white">{value}</p>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProductInspector({ open, detail, onClose }: ProductInspectorProps) {
  return (
    <Inspector open={open} onClose={onClose} title="Product" width={400}>
      {!detail ? (
        <div className="p-6 text-sm text-white/40">Loading…</div>
      ) : (
        <div className="space-y-4">
          {/* ── Header: image + name ── */}
          <section className="bg-neutral-900/60 border border-white/[0.08] rounded-lg p-3">
            <div className="flex items-start gap-3">
              {detail.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.imageUrl}
                  alt={detail.name}
                  className="w-16 h-16 rounded-md object-cover bg-white/[0.04] flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-md bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                  <span className="text-white/20 text-xs">No img</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-sm leading-tight">{detail.name}</p>
                <p className="text-white/40 text-xs mt-0.5">
                  Base price: {fmt.format(detail.basePrice)}
                </p>
                <p className="text-white/30 text-[10px] mt-1">
                  {formatDate(detail.rangeStart)} — {formatDate(detail.rangeEnd)}
                </p>
              </div>
            </div>
          </section>

          {/* ── Financial stats ── */}
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Units sold" value={detail.unitsSold.toLocaleString()} />
            <Stat label="Revenue" value={fmt.format(detail.revenue)} />
            <Stat label="Cost" value={fmt.format(detail.cost)} />
            <Stat
              label="Gross margin"
              value={`${fmt.format(detail.grossMargin)} (${detail.marginPct.toFixed(1)}%)`}
            />
          </div>

          {/* ── Link to product details ── */}
          <div className="pt-1">
            <Link
              href={`/admin/products/${detail.id}`}
              className="inline-flex items-center gap-1 text-xs text-[#FF3131] hover:text-[#ff4747] transition-colors"
            >
              Open product details →
            </Link>
          </div>
        </div>
      )}
    </Inspector>
  )
}
