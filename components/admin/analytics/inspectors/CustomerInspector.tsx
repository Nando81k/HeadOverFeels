'use client'

/**
 * CustomerInspector — read-only slide-out summary for a customer.
 *
 * Scope (Phase 6 Task 15):
 *  - Displays: email, name, signup date, totalSpent, totalOrders, AOV,
 *    loyaltyTierName, lastOrderDate.
 *  - "Open customer profile →" link to /admin/customers/${id} (V1 page).
 *  - Read-only: no mutation actions.
 */

import Link from 'next/link'
import type { CustomerDetailFull } from '@/app/admin/analytics/actions'
import { Inspector } from '@/components/ui/Inspector'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CustomerInspectorProps {
  open: boolean
  detail: CustomerDetailFull | null
  onClose: () => void
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-white/[0.04] last:border-b-0">
      <span className="text-[11px] uppercase tracking-wide text-white/40 whitespace-nowrap flex-shrink-0">
        {label}
      </span>
      <span className="text-sm text-white text-right break-all">{value}</span>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CustomerInspector({ open, detail, onClose }: CustomerInspectorProps) {
  return (
    <Inspector open={open} onClose={onClose} title="Customer" width={400}>
      {!detail ? (
        <div className="p-6 text-sm text-white/40">Loading…</div>
      ) : (
        <div className="space-y-4">
          {/* ── Identity ── */}
          <section className="bg-neutral-900/60 border border-white/[0.08] rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Identity</p>
            <Row label="Email" value={detail.email} />
            {detail.name && <Row label="Name" value={detail.name} />}
            <Row label="Signed Up" value={formatDate(detail.createdAt)} />
          </section>

          {/* ── Activity ── */}
          <section className="bg-neutral-900/60 border border-white/[0.08] rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Activity</p>
            <Row label="Lifetime Spend" value={currency.format(detail.totalSpent)} />
            <Row label="Orders" value={String(detail.totalOrders)} />
            <Row label="AOV" value={currency.format(detail.avgOrderValue)} />
            <Row label="Last Order" value={formatDate(detail.lastOrderDate)} />
          </section>

          {/* ── Loyalty ── */}
          <section className="bg-neutral-900/60 border border-white/[0.08] rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Loyalty</p>
            <Row label="Tier" value={detail.loyaltyTierName ?? '—'} />
          </section>

          {/* ── Profile link ── */}
          <div className="pt-1">
            <Link
              href={`/admin/customers/${detail.id}`}
              className="text-xs text-[#FF3131] hover:text-[#ff4747] transition-colors"
            >
              Open customer profile →
            </Link>
          </div>
        </div>
      )}
    </Inspector>
  )
}
