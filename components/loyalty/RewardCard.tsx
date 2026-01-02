import { Gift, Lock, Sparkle } from '@phosphor-icons/react/dist/ssr'

type TierSlug = 'bronze' | 'silver' | 'gold' | 'platinum'

interface Reward {
  id: string
  name: string
  description: string
  type: 'discount' | 'product' | 'experience'
  pointsCost: number
  discountType?: 'percentage' | 'fixed' | 'free_shipping' | null
  discountValue?: number | null
  minimumTier: TierSlug
  isActive: boolean
  totalAvailable?: number | null
}

interface RewardCardProps {
  reward: Reward
  userTier: TierSlug
  userPoints: number
  onRedeem?: (rewardId: string) => void
  isRedeeming?: boolean
  className?: string
}

const TIER_ORDER: TierSlug[] = ['bronze', 'silver', 'gold', 'platinum']

function canAccessReward(userTier: TierSlug, requiredTier: TierSlug): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(requiredTier)
}

function formatRewardValue(reward: Reward): string {
  if (reward.type === 'discount' && reward.discountType && reward.discountValue) {
    if (reward.discountType === 'percentage') {
      return `${reward.discountValue}% Off`
    } else if (reward.discountType === 'fixed') {
      return `$${reward.discountValue} Off`
    } else if (reward.discountType === 'free_shipping') {
      return 'Free Shipping'
    }
  }
  return reward.name
}

export function RewardCard({
  reward,
  userTier,
  userPoints,
  onRedeem,
  isRedeeming = false,
  className = '',
}: RewardCardProps) {
  const canAccess = canAccessReward(userTier, reward.minimumTier)
  const canAfford = userPoints >= reward.pointsCost
  const canRedeem = canAccess && canAfford && reward.isActive
  const isOutOfStock = reward.totalAvailable !== undefined && reward.totalAvailable !== null && reward.totalAvailable <= 0

  return (
    <div
      className={`
        relative p-6 rounded-2xl border-2
        ${canRedeem ? 'bg-white border-blue-200 hover:border-blue-400 hover:shadow-xl' : 'bg-gray-50 border-gray-200'}
        transition-all duration-300
        ${className}
      `}
    >
      {/* Tier badge */}
      {!canAccess && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-900 text-white text-xs font-semibold rounded-full">
            <Lock size={12} />
            <span className="capitalize">{reward.minimumTier}</span>
          </div>
        </div>
      )}

      {/* Out of stock badge */}
      {isOutOfStock && (
        <div className="absolute top-4 right-4 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
          OUT OF STOCK
        </div>
      )}

      {/* Icon */}
      <div
        className={`
          w-16 h-16 rounded-full flex items-center justify-center mb-4
          ${canRedeem ? 'bg-linear-to-br from-blue-500 to-purple-500' : 'bg-gray-300'}
        `}
      >
        {reward.type === 'product' ? (
          <Gift size={32} weight="bold" className="text-white" />
        ) : (
          <Sparkle size={32} weight="fill" className="text-white" />
        )}
      </div>

      {/* Content */}
      <div className="space-y-3">
        <div>
          <h3 className={`text-xl font-bold ${canRedeem ? 'text-gray-900' : 'text-gray-500'}`}>
            {reward.name}
          </h3>
          <p className="text-sm text-blue-600 font-semibold mt-1">{formatRewardValue(reward)}</p>
        </div>

        <p className={`text-sm ${canRedeem ? 'text-gray-600' : 'text-gray-400'} line-clamp-2`}>
          {reward.description}
        </p>

        {/* Points cost */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkle className={`w-4 h-4 ${canRedeem ? 'text-blue-600' : 'text-gray-400'}`} />
            <span className={`font-bold ${canRedeem ? 'text-blue-600' : 'text-gray-400'}`}>
              {reward.pointsCost.toLocaleString()} pts
            </span>
          </div>

          {reward.totalAvailable !== undefined && reward.totalAvailable !== null && reward.totalAvailable > 0 && (
            <span className="text-xs text-gray-500">{reward.totalAvailable} left</span>
          )}
        </div>

        {/* Redeem button */}
        {canAccess ? (
          <button
            onClick={() => onRedeem?.(reward.id)}
            disabled={!canRedeem || isRedeeming || isOutOfStock}
            className={`
              w-full py-3 rounded-xl font-semibold transition-all duration-300
              ${
                canRedeem && !isOutOfStock
                  ? 'bg-linear-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg hover:scale-105'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isRedeeming
              ? 'Redeeming...'
              : isOutOfStock
                ? 'Out of Stock'
                : !canAfford
                  ? `Need ${(reward.pointsCost - userPoints).toLocaleString()} more points`
                  : 'Redeem Now'}
          </button>
        ) : (
          <div className="py-3 px-4 rounded-xl bg-gray-100 text-center">
            <p className="text-sm text-gray-600">
              <span className="font-semibold capitalize">{reward.minimumTier} tier</span> required
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface RewardGridProps {
  rewards: Reward[]
  userTier: TierSlug
  userPoints: number
  onRedeem?: (rewardId: string) => void
  isRedeeming?: string | null
  className?: string
}

export function RewardGrid({
  rewards,
  userTier,
  userPoints,
  onRedeem,
  isRedeeming,
  className = '',
}: RewardGridProps) {
  if (rewards.length === 0) {
    return (
      <div className="text-center py-12">
        <Gift size={64} weight="bold" className="text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-600 mb-2">No rewards available</h3>
        <p className="text-gray-500">Check back later for new rewards!</p>
      </div>
    )
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {rewards.map((reward) => (
        <RewardCard
          key={reward.id}
          reward={reward}
          userTier={userTier}
          userPoints={userPoints}
          onRedeem={onRedeem}
          isRedeeming={isRedeeming === reward.id}
        />
      ))}
    </div>
  )
}
