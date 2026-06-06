'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface RevenueTrendPoint {
  bucket: string
  value: number
}

export interface RevenueTrendChartProps {
  data: RevenueTrendPoint[]
  height?: number
  /** Phase 6.5 wire-up: chart-point click → range narrow. v1 ships as no-op (TODO). */
  onPointClick?: (bucket: string) => void
  loading?: boolean
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function RevenueTrendChart({ data, height = 300, onPointClick, loading }: RevenueTrendChartProps) {
  // TODO(phase-6.5): wire onPointClick to chart's onClick. Recharts v3 uses
  // <LineChart onClick={(state) => onPointClick?.(state.activeLabel)}>
  void onPointClick

  if (loading) {
    return (
      <div className="flex items-center justify-center text-white/30 text-xs" style={{ height }}>
        Loading…
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-white/30 text-xs" style={{ height }}>
        No data for this range
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
          <XAxis dataKey="bucket" stroke="#ffffff66" style={{ fontSize: 11 }} />
          <YAxis stroke="#ffffff66" style={{ fontSize: 11 }} tickFormatter={(v) => fmt.format(Number(v))} />
          <Tooltip
            formatter={(v) => fmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ fill: '#ef4444', r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
