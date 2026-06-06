'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface TopProductPoint {
  productId: string
  name: string
  unitsSold: number
  revenue: number
}

export interface TopProductsBarProps {
  data: TopProductPoint[]
  height?: number
  onProductClick?: (productId: string) => void
  loading?: boolean
}

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function TopProductsBar({
  data,
  height = 300,
  onProductClick,
  loading = false,
}: TopProductsBarProps) {
  if (loading) {
    return (
      <div
        data-testid="top-products-bar-skeleton"
        className="animate-pulse rounded-lg bg-white/5"
        style={{ height }}
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

  // Top 10 by revenue, descending
  const top10 = [...data]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (payload: any) => {
    if (onProductClick && payload?.productId) {
      onProductClick(payload.productId as string)
    }
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={top10}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" horizontal={false} />
          <XAxis
            type="number"
            stroke="#ffffff66"
            style={{ fontSize: 11 }}
            tickFormatter={(v: number) => fmt.format(v)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#ffffff66"
            style={{ fontSize: 11 }}
            width={120}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: '#ffffff08' }}
            formatter={(v: unknown) => [fmt.format(Number(v)), 'Revenue']}
            contentStyle={{
              backgroundColor: '#0a0a0a',
              border: '1px solid #ffffff14',
              borderRadius: 8,
              fontSize: 12,
              color: '#fff',
            }}
          />
          <Bar
            dataKey="revenue"
            fill="#FF3131"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            onClick={handleBarClick}
            style={onProductClick ? { cursor: 'pointer' } : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
