'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export type StatusDonutSlice = {
  status: string
  count: number
}

export interface OrderStatusDonutProps {
  data: StatusDonutSlice[]
  height?: number
}

const COLORS: Record<string, string> = {
  PENDING: '#fbbf24',
  CONFIRMED: '#6366f1',
  PROCESSING: '#8b5cf6',
  SHIPPED: '#06b6d4',
  DELIVERED: '#10b981',
  CANCELLED: '#ef4444',
  REFUNDED: '#f97316',
}

export function OrderStatusDonut({ data, height = 300 }: OrderStatusDonutProps) {
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
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="status"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.status} fill={COLORS[d.status] ?? '#6b7280'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#ffffffaa' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
