import * as React from 'react'
import type { TierView } from '@/lib/loyalty/shopify-bridge'
import { Badge } from '@/components/storefront/ui/Badge'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { cn } from '@/lib/storefront/cn'
import { formatMultiplier, formatPoints } from './format'

export type TierRowView = Omit<TierView, 'current'> & { current?: boolean }

export interface TierTableProps {
  tiers: TierRowView[]
  /** The tier the customer is working towards, highlighted in signal. */
  nextTierId?: string | null
  pointsToNext?: number | null
}

function TierCard({
  tier,
  state,
  pointsToNext,
}: {
  tier: TierRowView
  state: 'current' | 'next' | null
  pointsToNext: number | null
}) {
  const titleId = React.useId()
  return (
    <article
      aria-labelledby={titleId}
      data-tier={state ?? undefined}
      className={cn(
        'flex h-full flex-col gap-4 rounded-sharp border p-5',
        state === 'current' && 'border-ink bg-ink text-bone',
        state === 'next' && 'border-signal bg-paper text-ink',
        state === null && 'border-line bg-paper text-ink'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Display as="h3" size="md" id={titleId}>
            {tier.name}
          </Display>
          <p className={cn('m-0 text-xs', state === 'current' ? 'text-bone/70' : 'text-ink-mute')}>
            {tier.minAnnualPoints > 0 ? (
              <>
                From <span className="num">{formatPoints(tier.minAnnualPoints)}</span> pts a year
              </>
            ) : (
              'Everyone starts here'
            )}
          </p>
        </div>
        {state === 'current' ? (
          <Badge variant="sale">You&apos;re here</Badge>
        ) : state === 'next' && pointsToNext !== null ? (
          <span className="rounded-sharp border border-signal px-2 py-1.5 text-[10px] font-semibold uppercase leading-none tracking-eyebrow text-signal">
            <span className="num">{formatPoints(pointsToNext)}</span> points away
          </span>
        ) : null}
      </div>
      <p className={cn('m-0 text-sm', state === 'current' ? 'text-bone/80' : 'text-ink-soft')}>
        <span className="num font-semibold">{formatMultiplier(tier.pointMultiplier)}</span> points on every order
      </p>
      {tier.perks.length > 0 ? (
        <ul className={cn('m-0 list-disc pl-5 text-sm', state === 'current' ? 'text-bone/80' : 'text-ink-soft')}>
          {tier.perks.map((perk) => (
            <li key={perk}>{perk}</li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

/** The tiers row (`#tiers`): current highlighted, next outlined in signal. */
export function TierTable({ tiers, nextTierId = null, pointsToNext = null }: TierTableProps) {
  return (
    <Section id="tiers" aria-labelledby="loyalty-tiers-title" className="scroll-mt-28">
      <div className="mb-8 flex flex-col gap-2">
        <Eyebrow>Climb</Eyebrow>
        <Display as="h2" size="md" id="loyalty-tiers-title">
          Tiers
        </Display>
        <p className="m-0 max-w-[36rem] text-sm text-ink-soft">
          Tiers follow the points you earn in a calendar year. Perks stack as you climb.
        </p>
      </div>
      {tiers.length === 0 ? (
        <p className="text-sm text-ink-soft">Tiers are being set up. Check back soon.</p>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
          {tiers.map((tier) => (
            <li key={tier.id}>
              <TierCard
                tier={tier}
                state={tier.current ? 'current' : tier.id === nextTierId ? 'next' : null}
                pointsToNext={pointsToNext}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
