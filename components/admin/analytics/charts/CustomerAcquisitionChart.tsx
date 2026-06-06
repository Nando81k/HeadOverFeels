'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export interface AcquisitionPoint {
  bucket: string
  newCustomers: number
  returningCustomers: number
}

export interface CustomerAcquisitionChartProps {
  data: AcquisitionPoint[]
  height?: number
  onPointClick?: (bucket: string) => void
  loading?: boolean
}

export function CustomerAcquisitionChart({ data, height = 300, onPointClick, loading }: CustomerAcquisitionChartProps) {
  void onPointClick // TODO(phase-6.5): wire click handler to drill-down date range
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
        <AreaChart data={data}>
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
          <Legend wrapperStyle={{ fontSize: 11, color: '#ffffffaa' }} />
          <Area
            type="monotone"
            dataKey="returningCustomers"
            stackId="1"
            stroke="#6366f1"
            fill="#6366f155"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="newCustomers"
            stackId="1"
            stroke="#FF3131"
            fill="#FF313155"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
