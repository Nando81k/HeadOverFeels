'use client'

import * as React from 'react'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { GA_MEASUREMENT_ID, track } from '@/lib/storefront/analytics'

export interface AnalyticsProps {
  /** Overrides the env-derived measurement id (tests); `null` disables gtag. */
  measurementId?: string | null
}

/**
 * The one analytics island in the storefront layout (Phase 5, Task 4).
 *
 * - Fires `page_view` on mount and on every pathname change (soft navigations
 *   included), through `track()`, so it lands on `window.dataLayer` like every
 *   other event.
 * - Loads gtag only when a GA4 measurement id is configured, with
 *   `send_page_view: false` — gtag reads the same `dataLayer`, so the
 *   `page_view` pushes above are what it reports. Without an id nothing is
 *   loaded and the dataLayer still fills, for GTM or a later sink.
 */
export function Analytics({ measurementId = GA_MEASUREMENT_ID }: AnalyticsProps) {
  const pathname = usePathname()

  React.useEffect(() => {
    if (!pathname) return
    track({ event: 'page_view', path: pathname, title: document.title })
  }, [pathname])

  if (!measurementId) return null

  return (
    <>
      <Script
        id="hof-gtag"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
      <Script id="hof-gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(measurementId)}, { send_page_view: false });`}
      </Script>
    </>
  )
}
