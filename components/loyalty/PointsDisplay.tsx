import { Coins, TrendUp, Lightning } from '@phosphor-icons/react/dist/ssr'

interface PointsDisplayProps {
  points: number
  variant?: 'default' | 'large' | 'compact'
  showIcon?: boolean
  className?: string
}

export function PointsDisplay({
  points,
  variant = 'default',
  showIcon = true,
  className = '',
}: PointsDisplayProps) {
  if (variant === 'large') {
    return (
      <div
        className={`
          flex flex-col items-center justify-center
          p-8 rounded-2xl
          bg-linear-to-br from-blue-50 to-purple-50
          border-2 border-blue-200
          ${className}
        `}
      >
        {showIcon && (
          <div className="w-16 h-16 rounded-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-4 shadow-lg">
            <Coins size={32} weight="bold" className="text-white" />
          </div>
        )}
        <p className="text-5xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-purple-600">
          {points.toLocaleString()}
        </p>
        <p className="text-sm text-gray-600 mt-2 font-medium">Points Available</p>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        {showIcon && <Coins size={16} weight="bold" className="text-blue-600" />}
        <span className="font-semibold text-blue-600">{points.toLocaleString()}</span>
      </div>
    )
  }

  return (
    <div
      className={`
        inline-flex items-center gap-3
        px-4 py-2 rounded-lg
        bg-white border-2 border-blue-200
        ${className}
      `}
    >
      {showIcon && (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <Coins size={20} weight="bold" className="text-blue-600" />
        </div>
      )}
      <div>
        <p className="text-xs text-gray-600">Your Points</p>
        <p className="text-xl font-bold text-blue-600">{points.toLocaleString()}</p>
      </div>
    </div>
  )
}

interface PointsEarnedAnimationProps {
  points: number
  onComplete?: () => void
}

export function PointsEarnedAnimation({ points, onComplete }: PointsEarnedAnimationProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onComplete}
    >
      <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full mx-4 animate-in zoom-in duration-300">
        <div className="flex flex-col items-center text-center">
          {/* Animated icon */}
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 bg-linear-to-br from-yellow-400 to-orange-500 rounded-full animate-pulse" />
            <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
              <Lightning size={48} weight="bold" className="text-yellow-500 animate-bounce" />
            </div>
          </div>

          {/* Points display */}
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Points Earned!</h2>
          <p className="text-6xl font-bold text-transparent bg-clip-text bg-linear-to-r from-yellow-500 to-orange-600 mb-4">
            +{points.toLocaleString()}
          </p>
          <p className="text-gray-600 mb-6">Keep shopping to earn more rewards</p>

          <button
            onClick={onComplete}
            className="px-8 py-3 bg-linear-to-r from-yellow-500 to-orange-600 text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  )
}

interface PointsHistoryItemProps {
  description: string
  points: number
  date: Date
  type: 'earned' | 'spent'
}

export function PointsHistoryItem({ description, points, date, type }: PointsHistoryItemProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center
            ${type === 'earned' ? 'bg-green-100' : 'bg-red-100'}
          `}
        >
          {type === 'earned' ? (
            <TrendUp size={20} weight="bold" className="text-green-600" />
          ) : (
            <Coins size={20} weight="bold" className="text-red-600" />
          )}
        </div>
        <div>
          <p className="font-medium text-gray-900">{description}</p>
          <p className="text-xs text-gray-500">{date.toLocaleDateString()}</p>
        </div>
      </div>
      <p
        className={`
          text-lg font-bold
          ${type === 'earned' ? 'text-green-600' : 'text-red-600'}
        `}
      >
        {type === 'earned' ? '+' : '-'}
        {points.toLocaleString()}
      </p>
    </div>
  )
}
