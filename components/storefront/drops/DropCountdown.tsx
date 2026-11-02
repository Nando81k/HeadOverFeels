'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/storefront/cn'
import { formatCountdown } from '@/lib/storefront/drops'

export interface DropCountdownProps {
  /** ISO timestamp of the transition being counted down to. */
  target: string
  /** "Opens in" / "Closes in". */
  label?: string
  className?: string
}

/** The live region is updated at most this often, so screen readers are not read every second. */
const ANNOUNCE_EVERY_MS = 60_000

/**
 * Ticking countdown to a drop transition. Renders the remaining time on the
 * server too (from the request's clock), then ticks every second on the
 * client. At zero it asks Next to refresh the route, so an ISR page cached in
 * the "upcoming" state flips to "live" without a reload; the server gate is
 * the source of truth either way.
 */
export function DropCountdown({ target, label = 'Opens in', className }: DropCountdownProps) {
  const router = useRouter()
  const targetMs = React.useMemo(() => new Date(target).getTime(), [target])
  const [remaining, setRemaining] = React.useState(() => Math.max(0, targetMs - Date.now()))
  const [announced, setAnnounced] = React.useState(remaining)
  const latest = React.useRef(remaining)
  const refreshed = React.useRef(false)

  React.useEffect(() => {
    const tick = () => {
      const next = Math.max(0, targetMs - Date.now())
      latest.current = next
      setRemaining(next)
      if (next === 0 && !refreshed.current) {
        refreshed.current = true
        router.refresh()
      }
    }
    tick()
    const timer = setInterval(tick, 1_000)
    return () => clearInterval(timer)
  }, [router, targetMs])

  // The screen-reader copy follows the clock once a minute, not every second.
  React.useEffect(() => {
    const timer = setInterval(() => setAnnounced(latest.current), ANNOUNCE_EVERY_MS)
    return () => clearInterval(timer)
  }, [])

  if (!Number.isFinite(targetMs)) return null

  return (
    <p data-drop-countdown="" className={cn('flex items-baseline gap-2 text-sm text-ink', className)}>
      <span className="text-xs uppercase tracking-eyebrow text-ink-mute">{label}</span>
      <time dateTime={target} className="num font-medium tabular-nums">
        {formatCountdown(remaining)}
      </time>
      <span className="sr-only" aria-live="polite">
        {`${label} ${formatCountdown(announced)}`}
      </span>
    </p>
  )
}
