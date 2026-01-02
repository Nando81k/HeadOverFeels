/**
 * ComparisonIndicator Component
 * 
 * Simple growth/decline indicator
 * - Percentage display
 * - Color-coded
 * - Arrow icons
 */

'use client';

import { TrendUp, TrendDown, Minus } from '@phosphor-icons/react';

interface ComparisonIndicatorProps {
  value: number; // Percentage change (-100 to infinity)
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export default function ComparisonIndicator({
  value,
  size = 'md',
  showLabel = false,
  label,
  className = ''
}: ComparisonIndicatorProps) {
  // Determine trend
  const trend = value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
  
  // Size classes
  const sizeClasses = {
    sm: {
      icon: 'w-3 h-3',
      text: 'text-xs',
      padding: 'px-1.5 py-0.5',
      gap: 'gap-0.5'
    },
    md: {
      icon: 'w-4 h-4',
      text: 'text-sm',
      padding: 'px-2 py-1',
      gap: 'gap-1'
    },
    lg: {
      icon: 'w-5 h-5',
      text: 'text-base',
      padding: 'px-3 py-1.5',
      gap: 'gap-1.5'
    }
  };

  // Color classes - dark theme
  const colorClasses = {
    up: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    down: 'bg-red-500/20 text-red-400 border-red-500/30',
    neutral: 'bg-white/10 text-white/50 border-white/20'
  };

  // Icon component
  const Icon = trend === 'up' ? TrendUp : trend === 'down' ? TrendDown : Minus;

  // Format value
  const formattedValue = Math.abs(value).toFixed(1);
  const displayValue = `${trend === 'up' ? '+' : trend === 'down' ? '-' : ''}${formattedValue}%`;

  return (
    <div className={`inline-flex items-center ${className}`}>
      <span
        className={`inline-flex items-center font-medium border ${
          sizeClasses[size].padding
        } ${sizeClasses[size].gap} ${colorClasses[trend]}`}
      >
        <Icon className={sizeClasses[size].icon} />
        <span className={sizeClasses[size].text}>{displayValue}</span>
      </span>
      {showLabel && label && (
        <span className={`ml-2 text-white/60 ${sizeClasses[size].text}`}>
          {label}
        </span>
      )}
    </div>
  );
}
