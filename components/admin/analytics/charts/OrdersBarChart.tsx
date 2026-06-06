'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface OrdersBarPoint {
  bucket: string
  value: number
}

export interface OrdersBarChartProps {
  data: OrdersBarPoint[]
  height?: number
  onPointClick?: (bucket: string) => void
  loading?: boolean
}

export function OrdersBarChart({ data, height = 300, onPointClick, loading }: OrdersBarChartProps) {
  void onPointClick // TODO(phase-6.5): wire click handler
  void loading

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
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
          <XAxis dataKey="bucket" stroke="#ffffff66" style={{ fontSize: 11 }} />
          <YAxis stroke="#ffffff66" style={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0a0a0a',
              border: '1px solid #ffffff14',
              borderRadius: 8,
              fontSize: 12,
              color: '#fff',
            }}
          />
          <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
