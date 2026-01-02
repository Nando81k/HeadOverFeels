import { Crown, Medal, Star, Diamond, Check } from '@phosphor-icons/react/dist/ssr'

type TierSlug = 'bronze' | 'silver' | 'gold' | 'platinum'

interface TierBadgeProps {
  tier?: TierSlug
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const TIER_CONFIG: Record<TierSlug, {
  icon: typeof Medal
  label: string
}> = {
  bronze: {
    icon: Medal,
    label: 'Bronze',
  },
  silver: {
    icon: Star,
    label: 'Silver',
  },
  gold: {
    icon: Crown,
    label: 'Gold',
  },
  platinum: {
    icon: Diamond,
    label: 'Platinum',
  },
}

const SIZE_CONFIG = {
  sm: {
    container: 'h-8 px-2',
    icon: 16,
    text: 'text-xs',
  },
  md: {
    container: 'h-10 px-3',
    icon: 20,
    text: 'text-sm',
  },
  lg: {
    container: 'h-12 px-4',
    icon: 24,
    text: 'text-base',
  },
}

export function TierBadge({ tier, size = 'md', showLabel = true, className = '' }: TierBadgeProps) {
  // Default to bronze if tier is undefined or invalid
  const validTier = tier && (tier in TIER_CONFIG) ? tier : 'bronze'
  const config = TIER_CONFIG[validTier]
  const sizeConfig = SIZE_CONFIG[size]
  const Icon = config.icon

  return (
    <div
      className={`
        inline-flex items-center gap-2
        bg-black
        ${sizeConfig.container}
        text-white font-semibold
        ${className}
      `}
    >
      <Icon size={sizeConfig.icon} weight="fill" />
      {showLabel && <span className={sizeConfig.text}>{config.label}</span>}
    </div>
  )
}

interface TierCardProps {
  tier?: TierSlug
  name?: string
  description?: string
  isCurrent?: boolean
  isCurrentTier?: boolean
  minSpend: number
  pointMultiplier?: number
  benefits: string[]
  className?: string
}

export function TierCard({
  tier,
  name,
  description,
  isCurrent = false,
  isCurrentTier = false,
  minSpend,
  pointMultiplier,
  benefits,
  className = '',
}: TierCardProps) {
  const currentTier = isCurrent || isCurrentTier

  return (
    <div
      className={`
        relative p-6 bg-white border border-black/10
        ${currentTier ? 'ring-2 ring-black' : ''}
        transition-all duration-300 hover:border-black/30
        ${className}
      `}
    >
      {currentTier && (
        <div className="absolute -top-3 left-6 bg-black text-white px-4 py-1 text-xs font-bold">
          YOUR TIER
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <TierBadge tier={tier} size="lg" />
        {name && (
          <div>
            <h3 className="text-lg font-bold text-black">{name}</h3>
            {description && <p className="text-sm text-black/60">{description}</p>}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex gap-6">
          <div>
            <p className="text-sm text-black/60">Min. Annual Spend</p>
            <p className="text-2xl font-bold text-black">
              ${minSpend.toLocaleString()}
            </p>
          </div>
          {pointMultiplier && (
            <div>
              <p className="text-sm text-black/60">Points Multiplier</p>
              <p className="text-2xl font-bold text-black">{pointMultiplier}x</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-bold text-black mb-2">Benefits</p>
          <ul className="space-y-1">
            {benefits.map((benefit, index) => (
              <li key={index} className="text-sm text-black/60 flex items-start gap-2">
                <Check size={16} weight="bold" className="text-black mt-0.5 shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
