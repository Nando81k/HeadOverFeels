/**
 * Customer Retention Chart Component
 * 
 * Displays customer retention and churn metrics with:
 * - Line chart showing retention rate over time
 * - New vs returning customer comparison
 * - Animated transitions
 * - Glass morphism dark theme
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Repeat, UserPlus, TrendUp, TrendDown } from '@phosphor-icons/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart
} from 'recharts';

interface RetentionData {
  month: string;
  newCustomers: number;
  returningCustomers: number;
  retentionRate: number;
}

interface CustomerRetentionChartProps {
  data: RetentionData[];
  loading?: boolean;
  height?: number;
}

// Custom tooltip
interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

function CustomTooltip({ 
  active, 
  payload, 
  label 
}: { 
  active?: boolean; 
  payload?: TooltipPayload[]; 
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-neutral-900/95 backdrop-blur-md px-4 py-3 border border-white/20 rounded-xl shadow-2xl"
      >
        <p className="text-sm font-semibold text-white mb-2">{label}</p>
        <div className="space-y-2">
          {payload.map((item: TooltipPayload) => {
            const isRate = item.dataKey === 'retentionRate';
            return (
              <div key={item.name} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-white/60">
                    {item.dataKey === 'newCustomers' ? 'New Customers' : 
                     item.dataKey === 'returningCustomers' ? 'Returning' : 'Retention Rate'}
                  </span>
                </div>
                <span className="text-sm font-medium text-white">
                  {isRate ? `${item.value}%` : item.value}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  }
  return null;
}

// Custom legend
function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  const labels: Record<string, string> = {
    newCustomers: 'New Customers',
    returningCustomers: 'Returning Customers',
    retentionRate: 'Retention Rate'
  };

  return (
    <div className="flex items-center justify-center gap-6 mt-4">
      {payload?.map((entry: { value: string; color: string }) => (
        <motion.div 
          key={entry.value}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2"
        >
          <div 
            className="w-3 h-3 rounded"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-white/60">{labels[entry.value] || entry.value}</span>
        </motion.div>
      ))}
    </div>
  );
}

export default function CustomerRetentionChart({
  data,
  loading = false,
  height = 350
}: CustomerRetentionChartProps) {
  const [chartType, setChartType] = useState<'area' | 'line'>('area');

  // Calculate average retention rate
  const avgRetention = data.length > 0 
    ? Math.round(data.reduce((sum, item) => sum + item.retentionRate, 0) / data.length)
    : 0;

  // Calculate retention trend
  const calculateTrend = () => {
    if (data.length < 2) return { change: 0, trend: 'neutral' };
    
    const recent = data.slice(-3).reduce((sum, item) => sum + item.retentionRate, 0) / 3;
    const previous = data.slice(-6, -3).reduce((sum, item) => sum + item.retentionRate, 0) / 3;
    
    if (previous === 0) return { change: 0, trend: 'neutral' };
    
    const change = ((recent - previous) / previous) * 100;
    return { 
      change: Math.abs(Math.round(change)), 
      trend: change >= 0 ? 'up' : 'down' 
    };
  };

  const retentionTrend = calculateTrend();

  // Loading skeleton
  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
      >
        <div className="h-6 bg-white/10 rounded w-1/3 animate-pulse mb-6"></div>
        <div className="h-64 bg-white/5 rounded-lg animate-pulse" />
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <motion.div 
            className="p-2 rounded-xl bg-blue-500/20"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <Repeat size={24} weight="bold" className="text-blue-400" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-white">Customer Retention</h3>
            <p className="text-sm text-white/40">New vs returning customers</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Retention Rate Badge */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10"
          >
            <span className="text-sm text-blue-400 font-medium">{avgRetention}% avg retention</span>
          </motion.div>

          {/* Trend Indicator */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
              retentionTrend.trend === 'up' 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : retentionTrend.trend === 'down'
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-white/10 text-white/60'
            }`}
          >
            {retentionTrend.trend === 'up' ? (
              <TrendUp size={14} weight="bold" />
            ) : retentionTrend.trend === 'down' ? (
              <TrendDown size={14} weight="bold" />
            ) : null}
            <span className="text-xs font-medium">{retentionTrend.change}%</span>
          </motion.div>

          {/* Chart Type Toggle */}
          <div className="flex items-center bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setChartType('area')}
              className={`px-3 py-1 text-xs rounded transition-all ${
                chartType === 'area' 
                  ? 'bg-white/10 text-white' 
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              Area
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1 text-xs rounded transition-all ${
                chartType === 'line' 
                  ? 'bg-white/10 text-white' 
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              Line
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height - 100}>
        {chartType === 'area' ? (
          <AreaChart 
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="newCustomersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="returningGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255,255,255,0.05)" 
              vertical={false}
            />
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
            />
            <YAxis 
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            <Area
              yAxisId="left"
              type="linear"
              dataKey="newCustomers"
              stroke="#60a5fa"
              strokeWidth={2}
              fill="url(#newCustomersGradient)"
              animationBegin={0}
              animationDuration={1200}
              animationEasing="ease-out"
            />
            <Area
              yAxisId="left"
              type="linear"
              dataKey="returningCustomers"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#returningGradient)"
              animationBegin={200}
              animationDuration={1200}
              animationEasing="ease-out"
            />
            <Line
              yAxisId="right"
              type="linear"
              dataKey="retentionRate"
              stroke="#a78bfa"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#a78bfa', r: 3 }}
              activeDot={{ r: 5, fill: '#a78bfa' }}
              animationBegin={400}
              animationDuration={1200}
              animationEasing="ease-out"
            />
          </AreaChart>
        ) : (
          <LineChart 
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255,255,255,0.05)" 
              vertical={false}
            />
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
            />
            <YAxis 
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            <Line
              yAxisId="left"
              type="linear"
              dataKey="newCustomers"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={{ fill: '#60a5fa', r: 3 }}
              activeDot={{ r: 5, fill: '#60a5fa' }}
              animationBegin={0}
              animationDuration={1200}
              animationEasing="ease-out"
            />
            <Line
              yAxisId="left"
              type="linear"
              dataKey="returningCustomers"
              stroke="#34d399"
              strokeWidth={2}
              dot={{ fill: '#34d399', r: 3 }}
              activeDot={{ r: 5, fill: '#34d399' }}
              animationBegin={200}
              animationDuration={1200}
              animationEasing="ease-out"
            />
            <Line
              yAxisId="right"
              type="linear"
              dataKey="retentionRate"
              stroke="#a78bfa"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#a78bfa', r: 3 }}
              activeDot={{ r: 5, fill: '#a78bfa' }}
              animationBegin={400}
              animationDuration={1200}
              animationEasing="ease-out"
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </motion.div>
  );
}
