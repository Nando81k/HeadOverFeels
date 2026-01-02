'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface OrderStatusFunnelProps {
  data: Array<{
    name: string
    value: number
  }>
}

const COLORS = {
  PENDING: '#facc15',
  CONFIRMED: '#3b82f6',
  PROCESSING: '#a855f7',
  SHIPPED: '#6366f1',
  DELIVERED: '#22c55e',
  CANCELLED: '#ef4444',
  REFUNDED: '#6b7280',
}

export function OrderStatusFunnel({ data }: OrderStatusFunnelProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry) => (
            <Cell 
              key={`cell-${entry.name}`} 
              fill={COLORS[entry.name as keyof typeof COLORS] || '#6b7280'} 
            />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '8px 12px'
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
