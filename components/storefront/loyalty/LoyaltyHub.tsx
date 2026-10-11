'use client'

import * as React from 'react'
import type { LoyaltyOverview, RewardView } from '@/lib/loyalty/shopify-bridge'
import type { LedgerPage } from '@/lib/loyalty/ledger'
import type { LoyaltyPublicData } from '@/lib/storefront/loyalty-public'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { EarnGrid } from './EarnGrid'
import { LOYALTY_ANCHORS, type LoyaltyAnchor } from './format'
import { LedgerTable, type LedgerAction } from './LedgerTable'
import { LoyaltyGate, LoyaltySignedOutHero } from './LoyaltySignedOut'
import { PointsHero } from './PointsHero'
import { RedeemDialog, type RedeemAction, type RedeemOutcome } from './RedeemDialog'
import { ReferralCard } from './ReferralCard'
import type { RewardCardMode } from './RewardCard'
import { RewardGrid, type RedeemedCode } from './RewardGrid'
import { TierTable } from './TierTable'

const ANCHOR_LABEL: Record<LoyaltyAnchor, string> = {
  rewards: 'Rewards',
  earn: 'How to earn',
  tiers: 'Tiers',
  history: 'History',
  refer: 'Refer a friend',
}

export interface LoyaltyHubProps {
  publicData: LoyaltyPublicData
  /** `hasCustomerAccountEnv()` from the route. */
  available: boolean
  /** A `hof_customer` session was present during render. */
  signedIn: boolean
  /** `getLoyaltyOverviewAction().data`, or null when signed out / failed. */
  initialOverview: LoyaltyOverview | null
  /** The first ledger page from `loadLedgerAction`, or null. */
  initialLedger: LedgerPage | null
  /** The action's error copy when signed in but the overview could not load. */
  overviewError?: string | null
  /** Inject fakes (tests). */
  actions?: { redeem?: RedeemAction; loadLedger?: LedgerAction }
}

/** The public catalogue in the card shape, with nothing redeemable. */
function publicRewards(data: LoyaltyPublicData): RewardView[] {
  return data.rewards.map((reward) => ({
    id: reward.id,
    name: reward.name,
    description: reward.description,
    type: reward.type,
    value: reward.value,
    pointsCost: reward.pointsCost,
    canRedeem: false,
    reason: 'ok',
    pointsShort: 0,
  }))
}

/** Re-gate the catalogue against a new balance; locks for other reasons stand. */
export function regateRewards(rewards: RewardView[], balance: number): RewardView[] {
  return rewards.map((reward) => {
    if (reward.reason !== 'ok' && reward.reason !== 'points') return { ...reward, pointsShort: Math.max(0, reward.pointsCost - balance) }
    const pointsShort = Math.max(0, reward.pointsCost - balance)
    return {
      ...reward,
      pointsShort,
      reason: pointsShort > 0 ? 'points' : 'ok',
      canRedeem: pointsShort === 0,
    }
  })
}

function AnchorNav() {
  return (
    <nav
      aria-label="Care Points sections"
      className="sticky top-16 z-30 border-b border-line bg-bone/95 backdrop-blur supports-[backdrop-filter]:bg-bone/80"
    >
      <ul className="mx-auto flex w-full max-w-shop list-none gap-6 overflow-x-auto px-gutter py-3 text-xs font-semibold uppercase tracking-eyebrow text-ink-soft">
        {LOYALTY_ANCHORS.map((anchor) => (
          <li key={anchor} className="shrink-0">
            <a
              href={`#${anchor}`}
              className="transition-colors duration-sf-fast ease-sf-out hover:text-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2"
            >
              {ANCHOR_LABEL[anchor]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <Eyebrow>{eyebrow}</Eyebrow>
      <Display as="h2" size="md" id={id}>
        {title}
      </Display>
    </div>
  )
}

/**
 * The Care Points hub (`/loyalty`, Phase 4 Task 6). Public sections render
 * for everyone; the balance, Redeem, history and referral need a session and
 * gate inline (plan, note 6). Owns the overview so a redemption updates the
 * balance and re-gates the catalogue without a refetch.
 */
export function LoyaltyHub({
  publicData,
  available,
  signedIn,
  initialOverview,
  initialLedger,
  overviewError = null,
  actions,
}: LoyaltyHubProps) {
  const [overview, setOverview] = React.useState<LoyaltyOverview | null>(initialOverview)
  const [activeReward, setActiveReward] = React.useState<RewardView | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [redeemed, setRedeemed] = React.useState<RedeemedCode | null>(null)

  const mode: RewardCardMode = overview ? 'signed-in' : available && !signedIn ? 'signed-out' : 'unavailable'
  const rewards = overview ? overview.rewards : publicRewards(publicData)
  const tiers = overview ? overview.tiers : publicData.tiers

  const openRedeem = (reward: RewardView) => {
    setActiveReward(reward)
    setDialogOpen(true)
  }

  const handleRedeemed = (data: RedeemOutcome, reward: RewardView) => {
    setRedeemed({
      code: data.code,
      rewardName: reward.name,
      expiresAt: data.expiresAt,
      appliedToCart: data.cart !== null,
    })
    setOverview((current) =>
      current
        ? { ...current, points: data.newBalance, rewards: regateRewards(current.rewards, data.newBalance) }
        : current
    )
  }

  return (
    <div data-loyalty-hub="" className="flex flex-col">
      {overview ? (
        <PointsHero overview={overview} />
      ) : (
        <LoyaltySignedOutHero available={available} signedIn={signedIn} />
      )}

      {signedIn && !overview && overviewError ? (
        <Section tone="paper" className="py-6">
          <p role="alert" className="m-0 rounded-sharp border border-danger bg-paper px-4 py-3 text-sm text-danger">
            {overviewError}
          </p>
        </Section>
      ) : null}

      <AnchorNav />

      <RewardGrid rewards={rewards} mode={mode} onRedeem={openRedeem} redeemed={redeemed} />

      <EarnGrid multiplier={overview?.multiplier ?? null} />

      <TierTable tiers={tiers} nextTierId={overview?.nextTier?.id ?? null} pointsToNext={overview?.pointsToNext ?? null} />

      {overview ? (
        <LedgerTable initialPage={initialLedger} loadLedger={actions?.loadLedger} />
      ) : (
        <Section id="history" aria-labelledby="loyalty-history-title" className="scroll-mt-28">
          <SectionHeading id="loyalty-history-title" eyebrow="Ledger" title="History" />
          <LoyaltyGate what="your history" available={available} signedIn={signedIn} />
        </Section>
      )}

      <Section id="refer" tone="paper" aria-labelledby="loyalty-refer-title" className="scroll-mt-28">
        <SectionHeading id="loyalty-refer-title" eyebrow="Share" title="Refer a friend" />
        {overview ? (
          <ReferralCard referral={overview.referral} className="max-w-3xl" />
        ) : (
          <LoyaltyGate what="your referral link" available={available} signedIn={signedIn} />
        )}
      </Section>

      {overview && activeReward ? (
        <RedeemDialog
          reward={activeReward}
          balance={overview.points}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onRedeemed={handleRedeemed}
          redeem={actions?.redeem}
        />
      ) : null}
    </div>
  )
}
