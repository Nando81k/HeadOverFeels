'use client'

import {
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface TierDistributionPoint {
  tierId: string | null
  tierName: string
  count: number
  percent: number
  color?: string
}

export interface TierDistributionChartProps {
  data: TierDistributionPoint[]
  height?: number
  loading?: boolean
}

const nFmt = new Intl.NumberFormat('en-US')

const DEFAULT_FILL = '#6366f1'

export function TierDistributionChart({
  data,
  height = 300,
  loading = false,
}: TierDistributionChartProps) {
  if (loading) {
    return (
      <div
        data-testid="tier-distribution-chart-skeleton"
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

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 48, bottom: 4, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#ffffff14"
            horizontal={false}
          />
          <XAxis
            type="number"
            stroke="#ffffff66"
            style={{ fontSize: 11 }}
            tickFormatter={(v: number) => nFmt.format(Number(v))}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="tierName"
            stroke="#ffffff66"
            style={{ fontSize: 11 }}
            width={80}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: '#ffffff08' }}
            formatter={(v: unknown) => [nFmt.format(Number(v)), 'Members']}
            contentStyle={{
              backgroundColor: '#0a0a0a',
              border: '1px solid #ffffff14',
              borderRadius: 8,
              fontSize: 12,
              color: '#fff',
            }}
          />
          <Bar
            dataKey="count"
            fill={DEFAULT_FILL}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="percent"
              position="right"
              formatter={(v: unknown) => `${Number(v).toFixed(0)}%`}
              style={{ fill: '#ffffffaa', fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
