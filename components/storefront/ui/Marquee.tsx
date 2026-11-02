import * as React from 'react'
import { cn } from '@/lib/storefront/cn'

const SPEED_DURATION = {
  slow: '40s',
  normal: '24s',
  fast: '14s',
} as const

const TONE_CLASS = {
  signal: 'bg-signal text-signal-ink',
  ink: 'bg-ink text-bone',
  bone: 'bg-bone text-ink border-y border-line',
} as const

export interface MarqueeProps {
  children: React.ReactNode
  speed?: keyof typeof SPEED_DURATION
  tone?: keyof typeof TONE_CLASS
  className?: string
}

/**
 * Infinite horizontal ticker (spec §5.2).
 *
 * The track holds two identical copies of `children` and slides by exactly one
 * copy width (-50%), so the loop is seamless; the second copy is hidden from
 * assistive tech. Each copy carries its own trailing gap (`pr-8`) rather than
 * the track using `gap-*`, which would make the two halves unequal and show a
 * seam at the wrap.
 *
 * The keyframes ship with the component via React 19 style hoisting (`href` +
 * `precedence` de-duplicate it across every instance) because
 * `styles/storefront/*` is owned by the tokens task.
 */
export function Marquee({ children, speed = 'normal', tone = 'signal', className }: MarqueeProps) {
  const copy = <div className="flex shrink-0 items-center gap-8 pr-8">{children}</div>

  return (
    <div
      className={cn(
        'group relative flex w-full overflow-hidden py-3',
        'text-[11px] font-semibold uppercase tracking-eyebrow whitespace-nowrap',
        TONE_CLASS[tone],
        className
      )}
    >
      <div
        data-marquee-track=""
        className={cn(
          'flex w-max whitespace-nowrap',
          'motion-safe:animate-[sf-marquee_var(--sf-marquee-duration)_linear_infinite]',
          'motion-reduce:animate-none',
          'group-hover:[animation-play-state:paused]'
        )}
        style={{ '--sf-marquee-duration': SPEED_DURATION[speed] } as React.CSSProperties}
      >
        {copy}
        <div aria-hidden="true" className="flex shrink-0 items-center gap-8 pr-8">
          {children}
        </div>
      </div>
      <style href="sf-marquee" precedence="default">
        {'@keyframes sf-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}'}
      </style>
    </div>
  )
}
