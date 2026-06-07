'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export interface PointsActivityPoint {
  bucket: string
  earned: number
  redeemed: number
}

export interface PointsActivityChartProps {
  data: PointsActivityPoint[]
  height?: number
  /** Wire-up: chart-point click → range narrow. v1 ships as no-op (TODO). */
  onPointClick?: (bucket: string) => void
  loading?: boolean
}

const nFmt = new Intl.NumberFormat('en-US')

export function PointsActivityChart({ data, height = 300, onPointClick, loading }: PointsActivityChartProps) {
  // TODO(phase-7.5): wire onPointClick to chart's onClick.
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
      <div className="h-[300px] flex items-center justify-center text-white/30 text-xs">
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
          <YAxis stroke="#ffffff66" style={{ fontSize: 11 }} tickFormatter={(v) => nFmt.format(Number(v))} />
          <Tooltip
            formatter={(v) => nFmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#ffffffaa' }} />
          <Line
            type="monotone"
            dataKey="earned"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ fill: '#6366f1', r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="redeemed"
            stroke="#FF3131"
            strokeWidth={2}
            dot={{ fill: '#FF3131', r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
