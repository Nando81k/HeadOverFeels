// lib/storefront/analytics.ts
//
// The storefront's analytics event stream (Phase 5 plan, Task 4). One typed
// `track()` that is a no-op on the server and, in the browser, pushes the
// event onto `window.dataLayer` (what GA4 / GTM read) and dispatches a
// `hof:analytics` DOM event so any other sink — or a later consent layer — can
// listen without this module knowing about it. Purchase events are Shopify
// checkout's job, not ours.

import type { DropState } from '@/lib/storefront/drops'

export type AnalyticsEvent =
  | { event: 'page_view'; path: string; title?: string }
  | {
      event: 'view_item'
      handle: string
      title: string
      price: number
      currency: string
      variantId?: string
      dropState?: DropState
    }
  | { event: 'add_to_cart'; variantId: string; quantity: number; price?: number; currency?: string }
  | { event: 'remove_from_cart'; lineId: string; quantity: number }
  | { event: 'begin_checkout'; value: number; currency: string; items: number }
  | { event: 'drop_view'; handle: string; state: DropState }
  | { event: 'early_access_unlocked'; handle: string }
  | { event: 'review_submitted'; handle: string; rating: number }
  | { event: 'back_in_stock_subscribed'; variantId: string }

export type AnalyticsEventName = AnalyticsEvent['event']

/** Name of the DOM event every tracked event is re-dispatched as. */
export const ANALYTICS_DOM_EVENT = 'hof:analytics'

/** GA4 measurement id; gtag loads only when this is set. */
export const GA_MEASUREMENT_ID: string | null = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || null

type DataLayerWindow = Window & { dataLayer?: unknown[] }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Record `event`. Safe to call anywhere: it does nothing without a `window`. */
export function track(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return
  try {
    const w = window as DataLayerWindow
    w.dataLayer = w.dataLayer ?? []
    w.dataLayer.push({ ...event })
    window.dispatchEvent(new CustomEvent<AnalyticsEvent>(ANALYTICS_DOM_EVENT, { detail: event }))
  } catch (error) {
    // Analytics must never break the page.
    console.warn(`[storefront] analytics track failed: ${errorMessage(error)}`)
  }
}

/** Subscribe to tracked events; returns the unsubscribe function. */
export function onAnalyticsEvent(listener: (event: AnalyticsEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (domEvent: Event) => {
    const detail = (domEvent as CustomEvent<AnalyticsEvent>).detail
    if (detail) listener(detail)
  }
  window.addEventListener(ANALYTICS_DOM_EVENT, handler)
  return () => window.removeEventListener(ANALYTICS_DOM_EVENT, handler)
}
