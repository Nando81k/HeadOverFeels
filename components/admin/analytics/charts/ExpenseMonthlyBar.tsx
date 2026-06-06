'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface MonthlyExpenseBar {
  month: string // YYYY-MM
  amount: number
}

export interface ExpenseMonthlyBarProps {
  data: MonthlyExpenseBar[]
  height?: number
  loading?: boolean
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function ExpenseMonthlyBar({ data, height = 300, loading }: ExpenseMonthlyBarProps) {
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
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
          <XAxis dataKey="month" stroke="#ffffff66" style={{ fontSize: 11 }} />
          <YAxis stroke="#ffffff66" style={{ fontSize: 11 }} tickFormatter={(v) => fmt.format(Number(v))} />
          <Tooltip
            formatter={(v) => fmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Bar dataKey="amount" fill="#ef4444" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
