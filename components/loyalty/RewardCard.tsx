import { Gift, Lock, Sparkle, Truck, Lightning, Heart, Package } from '@phosphor-icons/react/dist/ssr'

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

const TIER_LABELS: Record<TierSlug, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
}

function canAccessReward(userTier: TierSlug, requiredTier: TierSlug): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(requiredTier)
}

function formatRewardValue(reward: Reward): string {
  if (reward.type === 'discount' && reward.discountType && reward.discountValue) {
    if (reward.discountType === 'percentage') return `${reward.discountValue}% off`
    if (reward.discountType === 'fixed') return `$${reward.discountValue} off`
    if (reward.discountType === 'free_shipping') return 'Free shipping'
  }
  return reward.name
}

function RewardIcon({ type, locked }: { type: Reward['type']; locked: boolean }) {
  const cls = `w-6 h-6 ${locked ? 'text-black/25' : 'text-black'}`
  if (type === 'product') return <Gift size={24} weight="bold" className={cls} />
  if (type === 'experience') return <Heart size={24} weight="bold" className={cls} />
  return <Sparkle size={24} weight="fill" className={cls} />
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
  const isOutOfStock = reward.totalAvailable !== undefined && reward.totalAvailable !== null && reward.totalAvailable <= 0
  const canRedeem = canAccess && canAfford && reward.isActive && !isOutOfStock

  const pointsNeeded = reward.pointsCost - userPoints
  const progressPct = Math.min(100, Math.round((userPoints / reward.pointsCost) * 100))
  const handleRedeem = () => onRedeem?.(reward.id)

  // State-driven card styles
  const cardBase = 'relative rounded-2xl border p-5 transition-all duration-200 flex flex-col gap-4'
  const cardStyle = !canAccess
    ? `${cardBase} border-black/8 bg-black/[0.02] opacity-60`
    : isOutOfStock
      ? `${cardBase} border-black/10 bg-white opacity-50`
      : canRedeem
        ? `${cardBase} border-black/20 bg-white hover:border-black/40 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] cursor-pointer`
        : `${cardBase} border-black/10 bg-white`

  return (
    <div className={`${cardStyle} ${className}`}>

      {/* Tier-locked overlay badge */}
      {!canAccess && (
        <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-black/15 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-black/60">
          <Lock size={10} weight="bold" />
          {TIER_LABELS[reward.minimumTier]}
        </div>
      )}

      {/* Out-of-stock badge */}
      {isOutOfStock && !(!canAccess) && (
        <div className="absolute right-4 top-4 rounded-full border border-black/20 bg-black/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-black/50">
          Sold Out
        </div>
      )}

      {/* Icon + value */}
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${canAccess && !isOutOfStock ? 'border-black/15 bg-black/5' : 'border-black/8 bg-black/3'}`}>
          <RewardIcon type={reward.type} locked={!canAccess || isOutOfStock} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-black uppercase tracking-[0.12em] ${canAccess && !isOutOfStock ? 'text-black/50' : 'text-black/30'}`}>
            {formatRewardValue(reward)}
          </p>
          <h3 className={`mt-0.5 text-sm font-bold leading-snug ${canAccess ? 'text-black' : 'text-black/50'}`}>
            {reward.name}
          </h3>
        </div>
      </div>

      {/* Description */}
      <p className={`text-xs leading-relaxed ${canAccess ? 'text-black/55' : 'text-black/35'} line-clamp-2`}>
        {reward.description}
      </p>

      {/* Points + progress */}
      <div className="mt-auto space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkle size={12} weight="fill" className={canAccess && canAfford ? 'text-black' : 'text-black/35'} />
            <span className={`text-xs font-black tabular-nums ${canAccess && canAfford ? 'text-black' : 'text-black/50'}`}>
              {reward.pointsCost.toLocaleString()} pts
            </span>
          </div>
          {reward.totalAvailable !== undefined && reward.totalAvailable !== null && reward.totalAvailable > 0 && (
            <span className="text-[10px] text-black/40">{reward.totalAvailable} left</span>
          )}
        </div>

        {/* Progress bar — only when accessible but can't yet afford */}
        {canAccess && !canAfford && (
          <div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/8">
              <div
                className="h-full rounded-full bg-black/30 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-black/45">
              {pointsNeeded.toLocaleString()} more pts needed
            </p>
          </div>
        )}
      </div>

      {/* CTA */}
      {canAccess ? (
        <button
          onClick={handleRedeem}
          disabled={!canRedeem || isRedeeming}
          className={`
            w-full rounded-full py-2.5 text-xs font-black uppercase tracking-[0.12em] transition-all
            ${canRedeem
              ? 'bg-black text-white hover:bg-black/85 active:scale-[0.97]'
              : isOutOfStock
                ? 'cursor-not-allowed bg-black/8 text-black/30'
                : 'cursor-not-allowed bg-black/6 text-black/35'
            }
          `}
        >
          {isRedeeming
            ? 'Redeeming…'
            : isOutOfStock
              ? 'Sold Out'
              : !canAfford
                ? `${pointsNeeded.toLocaleString()} pts to go`
                : 'Redeem Now'}
        </button>
      ) : (
        <div className="rounded-full border border-black/10 py-2.5 text-center text-xs font-semibold uppercase tracking-widest text-black/35">
          <Lock size={11} weight="bold" className="mr-1.5 inline" />
          {TIER_LABELS[reward.minimumTier]} tier required
        </div>
      )}
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
      <div className="py-16 text-center">
        <Gift size={48} weight="thin" className="mx-auto mb-4 text-black/20" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-black/40">No rewards available</h3>
        <p className="mt-1 text-xs text-black/30">Check back soon for new rewards.</p>
      </div>
    )
  }

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
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
