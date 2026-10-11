import * as React from 'react'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { formatMultiplier } from './format'

/** The four earning rules (board 06). Values mirror `lib/loyalty/service.ts`. */
export const EARN_RULES = [
  { id: 'orders', amount: '1 pt per $1', title: 'Every order', copy: 'Points land as soon as an order is paid.' },
  { id: 'review', amount: '25 pts', title: 'Write a review', copy: 'Tell the next person how it fits.' },
  { id: 'referral', amount: '250 pts', title: 'Per referral', copy: 'When a friend you sent places a first order.' },
  { id: 'birthday', amount: '50 pts', title: 'On your birthday', copy: 'A gift from us, once a year.' },
] as const

export interface EarnGridProps {
  /** The signed-in tier multiplier, when above 1×. */
  multiplier?: number | null
}

/** The 4-up "How to earn" section (`#earn`). */
export function EarnGrid({ multiplier }: EarnGridProps) {
  const boosted = typeof multiplier === 'number' && multiplier > 1
  return (
    <Section id="earn" tone="paper" aria-labelledby="loyalty-earn-title" className="scroll-mt-28">
      <div className="mb-8 flex flex-col gap-2">
        <Eyebrow>Earn</Eyebrow>
        <Display as="h2" size="md" id="loyalty-earn-title">
          How to earn
        </Display>
        {boosted ? (
          <p className="m-0 text-sm text-ink-soft">
            Your tier multiplies order points by{' '}
            <span className="num font-semibold text-ink">{formatMultiplier(multiplier)}</span>.
          </p>
        ) : null}
      </div>
      <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {EARN_RULES.map((rule) => (
          <li key={rule.id} className="flex flex-col gap-2 rounded-sharp border border-line bg-bone p-5">
            <p className="num m-0 text-xl font-semibold text-ink">{rule.amount}</p>
            <h3 className="m-0 text-xs font-semibold uppercase tracking-eyebrow text-ink">{rule.title}</h3>
            <p className="m-0 text-sm text-ink-soft">{rule.copy}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}
