interface ProgressBarProps {
  current: number
  target: number
  label?: string
  showPercentage?: boolean
  color?: 'blue' | 'purple' | 'green' | 'amber'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const COLOR_CONFIG = {
  blue: 'from-blue-400 to-blue-600',
  purple: 'from-purple-400 to-purple-600',
  green: 'from-green-400 to-green-600',
  amber: 'from-amber-400 to-amber-600',
}

const SIZE_CONFIG = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
}

export function ProgressBar({
  current,
  target,
  label,
  showPercentage = true,
  color = 'blue',
  size = 'md',
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min((current / target) * 100, 100)
  const remaining = Math.max(target - current, 0)

  return (
    <div className={className}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && <p className="text-sm font-medium text-gray-700">{label}</p>}
          {showPercentage && (
            <p className="text-sm font-semibold text-gray-600">{Math.round(percentage)}%</p>
          )}
        </div>
      )}

      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${SIZE_CONFIG[size]}`}>
        <div
          className={`h-full bg-linear-to-r ${COLOR_CONFIG[color]} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {remaining > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          {typeof current === 'number' && current >= 1000
            ? `$${remaining.toLocaleString()} to go`
            : `${remaining} to go`}
        </p>
      )}
    </div>
  )
}

interface CircularProgressProps {
  current: number
  target: number
  size?: number
  strokeWidth?: number
  color?: string
  label?: string
  showValue?: boolean
}

export function CircularProgress({
  current,
  target,
  size = 120,
  strokeWidth = 8,
  color = '#3B82F6',
  label,
  showValue = true,
}: CircularProgressProps) {
  const percentage = Math.min((current / target) * 100, 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">{Math.round(percentage)}%</span>
            {label && <span className="text-xs text-gray-500 mt-1">{label}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
