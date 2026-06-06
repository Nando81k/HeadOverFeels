'use client'

import { useState } from 'react'
import { RevenueTrendChart } from '@/components/admin/analytics/charts/RevenueTrendChart'
import { OrdersBarChart } from '@/components/admin/analytics/charts/OrdersBarChart'
import { CustomerAcquisitionChart } from '@/components/admin/analytics/charts/CustomerAcquisitionChart'
import { OrderStatusDonut } from '@/components/admin/analytics/charts/OrderStatusDonut'
import { GoalsInspector } from '@/components/admin/analytics/inspectors/GoalsInspector'
import { ExportButton } from '@/components/admin/analytics/ExportButton'
import type { TimeRange, SalesGoalsRow } from '@/app/admin/analytics/actions'

// ─── Local data shapes (client-safe, no Prisma imports) ──────────────────────

export interface OverviewTabData {
  revenueTrend: { bucket: string; value: number }[]
  ordersTrend: { bucket: string; value: number }[]
  acquisitionTrend: { bucket: string; newCustomers: number; returningCustomers: number }[]
  statusDonut: { status: string; count: number }[]
  goals: SalesGoalsRow
}

export interface OverviewTabProps {
  data: OverviewTabData
  range: TimeRange
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

// ─── Component ───────────────────────────────────────────────────────────────

export function OverviewTab({ data, range }: OverviewTabProps) {
  const [goalsOpen, setGoalsOpen] = useState(false)

  return (
    <div className="space-y-4">
      {/* Header row: export button */}
      <div className="flex items-center justify-end gap-2">
        <ExportButton tab="overview" range={range} />
      </div>

      {/* 2×2 chart grid — single column on mobile, 2 columns on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Revenue trend */}
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Revenue</h3>
          <RevenueTrendChart data={data.revenueTrend} />
        </div>

        {/* Orders bar */}
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Orders</h3>
          <OrdersBarChart data={data.ordersTrend} />
        </div>

        {/* Customer acquisition */}
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Customer Acquisition</h3>
          <CustomerAcquisitionChart data={data.acquisitionTrend} />
        </div>

        {/* Order status donut */}
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Order Status</h3>
          <OrderStatusDonut data={data.statusDonut} />
        </div>
      </div>

      {/* Sales Goals card */}
      <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40">Sales Goals</h3>
          <button
            type="button"
            onClick={() => setGoalsOpen(true)}
            className="text-xs text-[#FF3131] hover:text-[#ff4747] transition-colors"
          >
            Edit goals
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm text-white/80">
          <div>
            <div className="text-white/40 text-xs mb-0.5">Daily</div>
            {fmt.format(data.goals.dailyTarget)}
          </div>
          <div>
            <div className="text-white/40 text-xs mb-0.5">Weekly</div>
            {fmt.format(data.goals.weeklyTarget)}
          </div>
          <div>
            <div className="text-white/40 text-xs mb-0.5">Monthly</div>
            {fmt.format(data.goals.monthlyTarget)}
          </div>
          <div>
            <div className="text-white/40 text-xs mb-0.5">Quarterly</div>
            {fmt.format(data.goals.quarterlyTarget)}
          </div>
          <div>
            <div className="text-white/40 text-xs mb-0.5">Yearly</div>
            {fmt.format(data.goals.yearlyTarget)}
          </div>
        </div>
      </div>

      {/* GoalsInspector — always mounted, controlled via open state */}
      <GoalsInspector
        open={goalsOpen}
        goals={data.goals}
        onClose={() => setGoalsOpen(false)}
      />
    </div>
  )
}
