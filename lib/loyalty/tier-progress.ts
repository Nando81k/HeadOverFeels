// Tier progression helper functions

export interface TierInfo {
  name: string
  slug: string
  minAnnualPoints: number  // Points earned this year required for tier
  pointMultiplier: number
}

export interface TierProgressTierInput {
  name: string
  slug: string
  minAnnualPoints: number
  pointMultiplier: number
}

export const TIER_HIERARCHY: TierInfo[] = [
  { name: 'Newcomer', slug: 'newcomer', minAnnualPoints: 0, pointMultiplier: 1.0 },
  { name: 'Friend', slug: 'friend', minAnnualPoints: 1000, pointMultiplier: 1.25 },
  { name: 'Bestie', slug: 'bestie', minAnnualPoints: 3000, pointMultiplier: 1.5 },
  { name: 'Soulmate', slug: 'soulmate', minAnnualPoints: 7500, pointMultiplier: 2.0 },
]

export interface TierProgress {
  currentTier: TierInfo
  nextTier: TierInfo | null
  currentPointsEarned: number  // Points earned this year
  pointsNeeded: number         // Points needed for next tier
  progressPercentage: number
  isMaxTier: boolean
}

function toSafeAnnualPoints(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0
  }
  return Math.max(0, value)
}

function normalizeProgressTiers(
  tiers: TierProgressTierInput[] | null | undefined
): TierInfo[] {
  const source = Array.isArray(tiers) && tiers.length > 0 ? tiers : TIER_HIERARCHY
  const bySlug = new Map<string, TierInfo>()

  for (const tier of source) {
    if (!tier || typeof tier !== 'object') continue

    const rawSlug = typeof tier.slug === 'string' ? tier.slug.trim().toLowerCase() : ''
    if (!rawSlug) continue

    const normalizedTier: TierInfo = {
      name: typeof tier.name === 'string' && tier.name.trim().length > 0 ? tier.name.trim() : rawSlug,
      slug: rawSlug,
      minAnnualPoints: toSafeAnnualPoints(tier.minAnnualPoints),
      pointMultiplier: typeof tier.pointMultiplier === 'number' && Number.isFinite(tier.pointMultiplier)
        ? Math.max(1, tier.pointMultiplier)
        : 1,
    }

    // First tier wins to keep deterministic behavior from admin ordering.
    if (!bySlug.has(rawSlug)) {
      bySlug.set(rawSlug, normalizedTier)
    }
  }

  const normalized = Array.from(bySlug.values())
  if (normalized.length === 0) {
    return [...TIER_HIERARCHY]
  }

  return normalized.sort((a, b) => {
    if (a.minAnnualPoints !== b.minAnnualPoints) {
      return a.minAnnualPoints - b.minAnnualPoints
    }
    return a.slug.localeCompare(b.slug)
  })
}

export function calculateTierProgressWithTiers(input: {
  currentTierSlug?: string | null
  annualPointsEarned?: number | null
  tiers?: TierProgressTierInput[] | null
}): TierProgress {
  const safeAnnualPoints = toSafeAnnualPoints(input.annualPointsEarned)
  const tiers = normalizeProgressTiers(input.tiers)
  const fallbackTier = tiers[0]
  const normalizedSlug = typeof input.currentTierSlug === 'string'
    ? input.currentTierSlug.trim().toLowerCase()
    : ''

  const currentTierFromSlug = normalizedSlug
    ? tiers.find((tier) => tier.slug === normalizedSlug) ?? null
    : null
  const inferredTier = [...tiers].reverse().find((tier) => safeAnnualPoints >= tier.minAnnualPoints) ?? fallbackTier
  const currentTier = currentTierFromSlug ?? inferredTier

  const currentTierIndex = tiers.findIndex((tier) => tier.slug === currentTier.slug)
  const nextTier = currentTierIndex >= 0 && currentTierIndex < tiers.length - 1
    ? tiers[currentTierIndex + 1]
    : null

  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      currentPointsEarned: safeAnnualPoints,
      pointsNeeded: 0,
      progressPercentage: 100,
      isMaxTier: true,
    }
  }

  const pointsNeeded = Math.max(0, nextTier.minAnnualPoints - safeAnnualPoints)
  const tierRange = Math.max(1, nextTier.minAnnualPoints - currentTier.minAnnualPoints)
  const pointsInCurrentTier = Math.max(0, safeAnnualPoints - currentTier.minAnnualPoints)
  const progressPercentage = Math.min(100, Math.max(0, (pointsInCurrentTier / tierRange) * 100))

  return {
    currentTier,
    nextTier,
    currentPointsEarned: safeAnnualPoints,
    pointsNeeded,
    progressPercentage,
    isMaxTier: false,
  }
}

export function calculateTierProgress(
  currentTierSlug: string,
  annualPointsEarned: number = 0
): TierProgress {
  return calculateTierProgressWithTiers({
    currentTierSlug,
    annualPointsEarned,
    tiers: TIER_HIERARCHY,
  })
}

export function getTierBySlug(slug: string): TierInfo | undefined {
  return TIER_HIERARCHY.find(t => t.slug === slug)
}

export function getTierFromPoints(annualPointsEarned: number): TierInfo {
  // Calculate the correct tier based on annual points earned
  // Returns the highest tier the user qualifies for
  const safePoints = typeof annualPointsEarned === 'number' && !isNaN(annualPointsEarned) ? annualPointsEarned : 0
  
  // Find the highest tier the user qualifies for
  let qualifiedTier = TIER_HIERARCHY[0] // Default to newcomer
  for (const tier of TIER_HIERARCHY) {
    if (safePoints >= tier.minAnnualPoints) {
      qualifiedTier = tier
    } else {
      break
    }
  }
  return qualifiedTier
}

export function calculateTierProgressFromPoints(annualPointsEarned: number): TierProgress {
  // Calculate tier progress based solely on points, not trusting database tier
  const correctTier = getTierFromPoints(annualPointsEarned)
  return calculateTierProgressWithTiers({
    currentTierSlug: correctTier.slug,
    annualPointsEarned,
    tiers: TIER_HIERARCHY,
  })
}

export function getNextTierBySlug(slug: string): TierInfo | null {
  const currentIndex = TIER_HIERARCHY.findIndex(t => t.slug === slug)
  if (currentIndex === -1 || currentIndex >= TIER_HIERARCHY.length - 1) {
    return null
  }
  return TIER_HIERARCHY[currentIndex + 1]
}
