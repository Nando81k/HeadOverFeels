'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export interface CategoryBreakdownSlice {
  categoryId: string
  categoryName: string
  color: string
  amount: number
}

export interface ExpenseCategoryDonutProps {
  data: CategoryBreakdownSlice[]
  height?: number
  loading?: boolean
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function ExpenseCategoryDonut({ data, height = 300, loading }: ExpenseCategoryDonutProps) {
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
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="categoryName"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.categoryId} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => fmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#ffffffaa' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
