'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/storefront/cn'
import { IconButton } from './IconButton'

const STORAGE_PREFIX = 'hof:announcement:'

const TONE_CLASS = {
  ink: 'bg-ink text-bone',
  signal: 'bg-signal text-signal-ink',
} as const

export interface AnnouncementBarProps {
  /** Storage key suffix — bump it to re-show the bar after copy changes. */
  id?: string
  children: React.ReactNode
  dismissible?: boolean
  tone?: keyof typeof TONE_CLASS
  className?: string
}

/**
 * Thin promo strip above the header.
 *
 * The dismissal is remembered for the session only (`sessionStorage`), and it
 * is read after mount so the server-rendered markup always contains the bar —
 * hiding it during hydration would otherwise mismatch.
 */
export function AnnouncementBar({
  id = 'announcement',
  children,
  dismissible = true,
  tone = 'ink',
  className,
}: AnnouncementBarProps) {
  const [dismissed, setDismissed] = React.useState(false)
  const storageKey = `${STORAGE_PREFIX}${id}`

  React.useEffect(() => {
    try {
      if (window.sessionStorage.getItem(storageKey) === '1') setDismissed(true)
    } catch {
      // Storage blocked (private mode, cookie policy): show the bar every time.
    }
  }, [storageKey])

  const handleDismiss = () => {
    setDismissed(true)
    try {
      window.sessionStorage.setItem(storageKey, '1')
    } catch {
      // Storage blocked: the dismissal simply does not persist.
    }
  }

  if (dismissed) return null

  return (
    <div
      role="region"
      aria-label="Announcement"
      className={cn(
        'relative flex h-9 items-center justify-center px-gutter',
        'text-[11px] font-medium tracking-[0.04em]',
        TONE_CLASS[tone],
        className
      )}
    >
      <span className="truncate">{children}</span>
      {dismissible ? (
        <IconButton
          label="Dismiss announcement"
          onClick={handleDismiss}
          // The bar is 36px tall, so the 44px default hit target is trimmed to
          // fit; the strip itself is not a primary control.
          className="absolute top-1/2 right-1 min-h-9 min-w-9 -translate-y-1/2 text-current hover:bg-paper/15"
        >
          <X aria-hidden="true" className="size-4" />
        </IconButton>
      ) : null}
    </div>
  )
}
