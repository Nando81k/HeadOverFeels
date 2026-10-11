// tests/unit/storefront/loyalty-fixture.ts — shared fakes for the Care Points hub suites (Task 6)
import type { LedgerPage, LedgerRow } from '@/lib/loyalty/ledger'
import type { LoyaltyOverview, RewardView, TierView } from '@/lib/loyalty/shopify-bridge'
import type { LoyaltyPublicData } from '@/lib/storefront/loyalty-public'

export const TIERS: TierView[] = [
  {
    id: 'tier-member',
    name: 'Member',
    slug: 'member',
    minAnnualPoints: 0,
    pointMultiplier: 1,
    perks: ['Birthday gift'],
    current: false,
  },
  {
    id: 'tier-insider',
    name: 'Insider',
    slug: 'insider',
    minAnnualPoints: 500,
    pointMultiplier: 1.25,
    perks: ['1.25x points on every order', 'Early drop access'],
    current: true,
  },
  {
    id: 'tier-inner-circle',
    name: 'Inner Circle',
    slug: 'inner-circle',
    minAnnualPoints: 1500,
    pointMultiplier: 1.5,
    perks: ['1.5x points on every order', 'Free shipping', 'Early drop access'],
    current: false,
  },
]

export const REWARDS: RewardView[] = [
  {
    id: 'reward-5',
    name: '$5 off',
    description: 'Five dollars off any order.',
    type: 'DISCOUNT',
    value: 5,
    pointsCost: 500,
    canRedeem: true,
    reason: 'ok',
    pointsShort: 0,
  },
  {
    id: 'reward-ship',
    name: 'Free shipping',
    description: 'Shipping on us, one order.',
    type: 'FREE_SHIPPING',
    value: null,
    pointsCost: 750,
    canRedeem: true,
    reason: 'ok',
    pointsShort: 0,
  },
  {
    id: 'reward-20',
    name: '$20 off',
    description: 'Twenty dollars off any order.',
    type: 'DISCOUNT',
    value: 20,
    pointsCost: 2000,
    canRedeem: false,
    reason: 'points',
    pointsShort: 760,
  },
  {
    id: 'reward-drop',
    name: 'Early drop access',
    description: 'Shop the next drop a day early.',
    type: 'EARLY_ACCESS',
    value: null,
    pointsCost: 300,
    canRedeem: false,
    reason: 'tier',
    pointsShort: 0,
  },
  {
    id: 'reward-limit',
    name: 'Welcome $10',
    description: 'Once per customer.',
    type: 'DISCOUNT',
    value: 10,
    pointsCost: 100,
    canRedeem: false,
    reason: 'limit',
    pointsShort: 0,
  },
  {
    id: 'reward-soldout',
    name: 'Signed tee',
    description: 'A run of fifty.',
    type: 'OTHER',
    value: null,
    pointsCost: 900,
    canRedeem: false,
    reason: 'soldout',
    pointsShort: 0,
  },
]

export const OVERVIEW: LoyaltyOverview = {
  points: 1240,
  lifetimePoints: 3210,
  annualPoints: 980,
  tier: TIERS[1],
  nextTier: TIERS[2],
  pointsToNext: 520,
  progressRatio: 0.48,
  multiplier: 1.25,
  expiringSoon: { points: 120, at: '2026-11-30T00:00:00.000Z' },
  rewards: REWARDS,
  tiers: TIERS,
  referral: {
    code: 'NANDO-7F2K',
    url: 'https://headoverfeels.test/?ref=NANDO-7F2K',
    joined: 3,
    ordered: 1,
    pointsEarned: 250,
  },
}

export const PUBLIC_DATA: LoyaltyPublicData = {
  tiers: TIERS.map((tier) => ({
    id: tier.id,
    name: tier.name,
    slug: tier.slug,
    minAnnualPoints: tier.minAnnualPoints,
    pointMultiplier: tier.pointMultiplier,
    perks: tier.perks,
  })),
  rewards: REWARDS.map((reward) => ({
    id: reward.id,
    name: reward.name,
    description: reward.description,
    type: reward.type,
    value: reward.value,
    pointsCost: reward.pointsCost,
    minTierRequired: reward.id === 'reward-drop' ? 'inner-circle' : null,
  })),
}

export const LEDGER_ROWS: LedgerRow[] = [
  {
    id: 'tx-1',
    at: '2026-10-02T14:00:00.000Z',
    points: 96,
    kind: 'earned',
    label: 'Points from your purchase',
    reference: { type: 'order', label: '#1042', href: '/account/orders/gid%3A%2F%2Fshopify%2FOrder%2F1042' },
  },
  {
    id: 'tx-2',
    at: '2026-09-20T10:00:00.000Z',
    points: -500,
    kind: 'redeemed',
    label: 'Redeemed $5 off',
    reference: { type: 'code', label: 'HOF-DISC-4K2M9Q', href: null },
  },
  {
    id: 'tx-3',
    at: '2026-09-01T09:00:00.000Z',
    points: 25,
    kind: 'earned',
    label: 'Points for writing a review',
    reference: { type: 'review', label: 'Review', href: null },
  },
]

export const LEDGER_PAGE: LedgerPage = { rows: LEDGER_ROWS, nextCursor: 'tx-3' }

export function overviewWith(patch: Partial<LoyaltyOverview>): LoyaltyOverview {
  return { ...OVERVIEW, ...patch }
}
