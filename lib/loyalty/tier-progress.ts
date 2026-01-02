// Tier progression helper functions

export interface TierInfo {
  name: string
  slug: string
  minAnnualPoints: number  // Points earned this year required for tier
  pointMultiplier: number
}

export const TIER_HIERARCHY: TierInfo[] = [
  { name: 'Head', slug: 'head', minAnnualPoints: 0, pointMultiplier: 1.0 },
  { name: 'Heart', slug: 'heart', minAnnualPoints: 200, pointMultiplier: 1.25 },
  { name: 'Mind', slug: 'mind', minAnnualPoints: 500, pointMultiplier: 1.5 },
  { name: 'Overdrive', slug: 'overdrive', minAnnualPoints: 2000, pointMultiplier: 2.0 },
]

export interface TierProgress {
  currentTier: TierInfo
  nextTier: TierInfo | null
  currentPointsEarned: number  // Points earned this year
  pointsNeeded: number         // Points needed for next tier
  progressPercentage: number
  isMaxTier: boolean
}

export function calculateTierProgress(
  currentTierSlug: string,
  annualPointsEarned: number = 0
): TierProgress {
  // Ensure annualPointsEarned is a valid number
  const safeAnnualPoints = typeof annualPointsEarned === 'number' && !isNaN(annualPointsEarned) ? annualPointsEarned : 0
  
  const currentTierIndex = TIER_HIERARCHY.findIndex(t => t.slug === currentTierSlug)
  const currentTier = TIER_HIERARCHY[currentTierIndex]
  
  // If tier not found, default to first tier
  if (!currentTier) {
    return calculateTierProgress('head', safeAnnualPoints)
  }
  
  const nextTier = currentTierIndex < TIER_HIERARCHY.length - 1 
    ? TIER_HIERARCHY[currentTierIndex + 1] 
    : null

  if (!nextTier) {
    // Max tier reached
    return {
      currentTier,
      nextTier: null,
      currentPointsEarned: safeAnnualPoints,
      pointsNeeded: 0,
      progressPercentage: 100,
      isMaxTier: true,
    }
  }

  const pointsInCurrentTier = safeAnnualPoints - currentTier.minAnnualPoints
  const pointsNeededForNextTier = nextTier.minAnnualPoints - currentTier.minAnnualPoints
  const progressPercentage = Math.min(
    100,
    Math.max(0, (pointsInCurrentTier / pointsNeededForNextTier) * 100)
  )
  const pointsNeeded = Math.max(0, nextTier.minAnnualPoints - safeAnnualPoints)

  return {
    currentTier,
    nextTier,
    currentPointsEarned: safeAnnualPoints,
    pointsNeeded,
    progressPercentage,
    isMaxTier: false,
  }
}

export function getTierBySlug(slug: string): TierInfo | undefined {
  return TIER_HIERARCHY.find(t => t.slug === slug)
}

export function getNextTierBySlug(slug: string): TierInfo | null {
  const currentIndex = TIER_HIERARCHY.findIndex(t => t.slug === slug)
  if (currentIndex === -1 || currentIndex >= TIER_HIERARCHY.length - 1) {
    return null
  }
  return TIER_HIERARCHY[currentIndex + 1]
}
