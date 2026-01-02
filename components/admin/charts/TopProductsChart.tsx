'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface TopProductsChartProps {
  data: Array<{
    name: string
    sales: number
    revenue: number
  }>
}

export function TopProductsChart({ data }: TopProductsChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value)
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="name" 
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis 
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          tickFormatter={formatCurrency}
        />
        <Tooltip 
          formatter={(value: number, name: string) => {
            if (name === 'revenue') return formatCurrency(value)
            return value
          }}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '8px 12px'
          }}
        />
        <Legend />
        <Bar dataKey="sales" fill="#6366f1" name="Units Sold" />
        <Bar dataKey="revenue" fill="#FF3131" name="Revenue" />
      </BarChart>
    </ResponsiveContainer>
  )
}
