'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export interface DualTrendPoint {
  bucket: string
  revenue: number
  expenses: number
}

export interface RevenueExpenseAreaProps {
  data: DualTrendPoint[]
  height?: number
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function RevenueExpenseArea({ data, height = 300 }: RevenueExpenseAreaProps) {
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
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
          <XAxis dataKey="bucket" stroke="#ffffff66" style={{ fontSize: 11 }} />
          <YAxis stroke="#ffffff66" style={{ fontSize: 11 }} tickFormatter={(v) => fmt.format(Number(v))} />
          <Tooltip
            formatter={(v) => fmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#ffffffaa' }} />
          <Area
            type="monotone"
            dataKey="revenue"
            stackId="1"
            stroke="#10b981"
            fill="#10b98155"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="expenses"
            stackId="2"
            stroke="#ef4444"
            fill="#ef444455"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
