'use client'

import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface MarginScatterPoint {
  productId: string
  name: string
  price: number
  marginPct: number
  unitsSold: number
}

export interface MarginScatterProps {
  data: MarginScatterPoint[]
  height?: number
  /** Custom axis labels — CustomersTab reuses this for LTV scatter (xLabel="Total Spent", yLabel="Orders"). */
  xLabel?: string
  yLabel?: string
  onPointClick?: (productId: string) => void
  loading?: boolean
}

export function MarginScatter({
  data,
  height = 300,
  xLabel = 'Price',
  yLabel = 'Margin %',
  onPointClick,
  loading,
}: MarginScatterProps) {
  // TODO(phase-6.5): wire onPointClick to ScatterChart onClick handler.
  void onPointClick

  if (loading) {
    return (
      <div
        className="animate-pulse rounded-lg bg-white/5"
        style={{ height }}
        aria-label="Loading chart"
      />
    )
  }

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-white/30 text-xs"
        style={{ height }}
      >
        No data for this range
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
          <XAxis
            type="number"
            dataKey="price"
            name={xLabel}
            stroke="#ffffff66"
            style={{ fontSize: 11 }}
            label={{ value: xLabel, position: 'insideBottom', offset: -4, fill: '#ffffff66', fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="marginPct"
            name={yLabel}
            stroke="#ffffff66"
            style={{ fontSize: 11 }}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#ffffff66', fontSize: 11 }}
          />
          <ZAxis type="number" dataKey="unitsSold" range={[40, 400]} name="Units" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{
              backgroundColor: '#0a0a0a',
              border: '1px solid #ffffff14',
              borderRadius: 8,
              fontSize: 12,
              color: '#fff',
            }}
          />
          <Scatter data={data} fill="#FF3131" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
