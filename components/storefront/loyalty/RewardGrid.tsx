'use client'

import * as React from 'react'
import Link from 'next/link'
import type { RewardView } from '@/lib/loyalty/shopify-bridge'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { CopyButton } from './CopyButton'
import { formatDate } from './format'
import { RewardCard, type RewardCardMode } from './RewardCard'

export type RedeemedCode = {
  code: string
  rewardName: string
  /** ISO; empty for rewards that mint no code. */
  expiresAt: string
  /** True when the action applied the code to the visitor's cart. */
  appliedToCart: boolean
}

export interface RewardGridProps {
  rewards: RewardView[]
  mode: RewardCardMode
  onRedeem?: (reward: RewardView) => void
  /** The most recent redemption of this visit, shown as the green banner. */
  redeemed?: RedeemedCode | null
}

/** The green "redeemed" banner (board 06): code, Copy, View cart. */
export function RedeemedBanner({ redeemed }: { redeemed: RedeemedCode }) {
  const fieldRef = React.useRef<HTMLInputElement>(null)
  const hasCode = redeemed.code.length > 0
  return (
    <div
      role="status"
      data-redeemed=""
      className="mb-8 flex flex-col gap-4 rounded-sharp bg-ok p-5 text-paper sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-eyebrow text-paper/80">
          Redeemed · {redeemed.rewardName}
        </p>
        {hasCode ? (
          <>
            <p className="num m-0 text-2xl font-semibold tracking-wide">{redeemed.code}</p>
            <input
              ref={fieldRef}
              readOnly
              aria-hidden="true"
              tabIndex={-1}
              value={redeemed.code}
              className="sr-only"
            />
            <p className="m-0 text-xs text-paper/80">
              {redeemed.appliedToCart ? 'Applied to your cart.' : 'Add it at checkout.'}
              {redeemed.expiresAt ? ` Valid until ${formatDate(redeemed.expiresAt)}.` : ''}
            </p>
          </>
        ) : (
          <p className="m-0 text-sm">You&apos;re in. Early access is on your account.</p>
        )}
      </div>
      {hasCode ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          <CopyButton
            value={redeemed.code}
            fallbackRef={fieldRef}
            className="border-paper text-paper hover:bg-paper hover:text-ok"
          />
          <Button asChild size="sm" className="bg-paper text-ok hover:bg-bone">
            <Link href="/cart">View cart</Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/** The 4-up catalogue section (`#rewards`). */
export function RewardGrid({ rewards, mode, onRedeem, redeemed }: RewardGridProps) {
  return (
    <Section id="rewards" aria-labelledby="loyalty-rewards-title" className="scroll-mt-28">
      <div className="mb-8 flex flex-col gap-2">
        <Eyebrow>Spend</Eyebrow>
        <Display as="h2" size="md" id="loyalty-rewards-title">
          Rewards
        </Display>
      </div>
      {redeemed ? <RedeemedBanner redeemed={redeemed} /> : null}
      {rewards.length === 0 ? (
        <p className="text-sm text-ink-soft">Rewards are being set up. Check back soon.</p>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {rewards.map((reward) => (
            <li key={reward.id} className="flex">
              <RewardCard reward={reward} mode={mode} onRedeem={onRedeem} className="w-full" />
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
