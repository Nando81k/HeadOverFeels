'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

export interface SparklineProps {
  data: number[]
  color?: string
  height?: number
  strokeWidth?: number
  className?: string
}

export function Sparkline({
  data,
  color = '#ff3131',
  height = 32,
  strokeWidth = 1.5,
  className,
}: SparklineProps) {
  if (data.length === 0) return null

  const chartData = data.map((v, i) => ({ x: i, y: v }))

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="y"
            stroke={color}
            strokeWidth={strokeWidth}
            dot={false}
            isAnimationActive={false}
            filter={`drop-shadow(0 0 4px ${color}66)`}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
