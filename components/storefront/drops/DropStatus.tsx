import * as React from 'react'
import { Badge } from '@/components/storefront/ui/Badge'
import { cn } from '@/lib/storefront/cn'
import { dropCopy, formatDropWindow, type DropView } from '@/lib/storefront/drops'
import { DropCountdown } from './DropCountdown'

export interface DropStatusProps {
  view: DropView
  /** Show the ticking countdown to the next transition (default true). */
  countdown?: boolean
  className?: string
}

const BADGE_LABEL: Record<DropView['state'], string> = {
  upcoming: 'Drop',
  'early-access': 'Early access',
  live: 'Drop',
  ended: 'Drop ended',
}

/**
 * The drop line under a product title (PDP, spotlight): a badge for the state,
 * the headline ("Opens Sep 6, 9:00 AM" / "Live now" / "This drop has ended"),
 * the window and, while something is counting down, the live countdown.
 * Server-safe apart from the countdown island.
 */
export function DropStatus({ view, countdown = true, className }: DropStatusProps) {
  const copy = dropCopy(view)
  const window = formatDropWindow(view)
  const ticking = countdown && view.nextTransitionIn !== null && view.state !== 'ended'
  const target = view.state === 'live' ? view.end : view.start

  return (
    <div data-drop-status={view.state} className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={view.state === 'ended' ? 'soldout' : 'drop'}>{BADGE_LABEL[view.state]}</Badge>
        <span className="text-sm font-medium text-ink">{copy.headline}</span>
        {window ? <span className="text-xs text-ink-mute">{window}</span> : null}
      </div>
      {copy.detail ? <p className="text-xs text-ink-mute">{copy.detail}</p> : null}
      {ticking && target ? (
        <DropCountdown
          target={target.toISOString()}
          label={view.state === 'live' ? 'Closes in' : 'Opens in'}
        />
      ) : null}
    </div>
  )
}
