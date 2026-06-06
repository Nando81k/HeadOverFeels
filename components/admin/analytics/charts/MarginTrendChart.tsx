'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface MarginTrendPoint {
  bucket: string
  value: number // percentage 0-100
}

export interface MarginTrendChartProps {
  data: MarginTrendPoint[]
  height?: number
  loading?: boolean
}

export function MarginTrendChart({ data, height = 300, loading }: MarginTrendChartProps) {
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
          <YAxis
            stroke="#ffffff66"
            style={{ fontSize: 11 }}
            unit="%"
            tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
            domain={[0, 100]}
          />
          <Tooltip
            formatter={(v) => `${Number(v).toFixed(1)}%`}
            contentStyle={{
              backgroundColor: '#0a0a0a',
              border: '1px solid #ffffff14',
              borderRadius: 8,
              fontSize: 12,
              color: '#fff',
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
