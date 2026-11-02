'use client'

import * as React from 'react'
import type { LoyaltyOverview } from '@/lib/loyalty/shopify-bridge'
import { Button } from '@/components/storefront/ui/Button'
import { fieldLabelClass, fieldVariants } from '@/components/storefront/ui/Input'
import { cn } from '@/lib/storefront/cn'
import { CopyButton } from './CopyButton'
import { formatPoints } from './format'

export interface ReferralCardProps {
  referral: LoyaltyOverview['referral']
  className?: string
}

const SHARE_COPY = 'Heavyweight streetwear, honest fits. Use my link and we both earn Care Points:'

/** Share links the OS can open without a third-party SDK. */
export function shareLinks(url: string): { label: string; href: string }[] {
  const body = encodeURIComponent(`${SHARE_COPY} ${url}`)
  const subject = encodeURIComponent('Come get Care Points at Head Over Feels')
  return [
    { label: 'Text a friend', href: `sms:?&body=${body}` },
    { label: 'Email a friend', href: `mailto:?subject=${subject}&body=${body}` },
  ]
}

/** The referral card (`#refer`): read-only link, Copy, share links, the three stats. */
export function ReferralCard({ referral, className }: ReferralCardProps) {
  const fieldRef = React.useRef<HTMLInputElement>(null)
  const fieldId = React.useId()
  const stats = [
    { label: 'Joined', value: formatPoints(referral.joined) },
    { label: 'Ordered', value: formatPoints(referral.ordered) },
    { label: 'Points earned', value: formatPoints(referral.pointsEarned) },
  ]

  return (
    <div className={cn('flex flex-col gap-6 rounded-sharp border border-line bg-paper p-6', className)}>
      <div className="flex flex-col gap-2">
        <label htmlFor={fieldId} className={fieldLabelClass}>
          Your referral link
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={fieldRef}
            id={fieldId}
            readOnly
            value={referral.url}
            onFocus={(event) => event.currentTarget.select()}
            className={cn(fieldVariants({ invalid: false }), 'num text-xs')}
          />
          <CopyButton value={referral.url} fallbackRef={fieldRef} size="md" className="shrink-0" />
        </div>
        <p className="m-0 text-xs text-ink-mute">
          Your code <span className="num font-semibold text-ink">{referral.code}</span> · a friend&apos;s first paid
          order earns you <span className="num font-semibold text-ink">250</span> points.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {shareLinks(referral.url).map((link) => (
          <Button key={link.label} asChild variant="outline" size="sm">
            <a href={link.href}>{link.label}</a>
          </Button>
        ))}
      </div>

      <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <dt className="text-[11px] font-semibold uppercase tracking-eyebrow text-ink-mute">{stat.label}</dt>
            <dd className="num m-0 text-lg font-semibold text-ink">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
