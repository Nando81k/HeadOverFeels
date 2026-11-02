// lib/storefront/drops.ts
//
// The drop state machine (design spec decision 10; Phase 5 plan, Task 1).
// Pure: no React, no I/O, no `next/*` imports — the PDP, the `/drops` page,
// the home spotlight, the cart gate and the e2e mock all derive the same state
// from the same three Shopify metafields (`custom.drop_start`,
// `custom.drop_end`, `custom.max_per_order`).

export type DropState = 'upcoming' | 'early-access' | 'live' | 'ended'

/** The metafield shape as the normalisers expose it (`ProductDetail['drop']`, `ProductCardData['drop']`). */
export type DropWindow = {
  start: string | null
  end: string | null
  maxPerOrder?: number | null
}

export type DropView = {
  state: DropState
  start: Date | null
  end: Date | null
  maxPerOrder: number | null
  /**
   * Milliseconds until the next transition: `start` while upcoming / in early
   * access, `end` while live, `null` when there is none (open-ended or ended).
   */
  nextTransitionIn: number | null
}

/** A missing or unparsable date counts as "not set". */
export function toDropDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * The state of a drop at `now`.
 *
 * - `null` → not a drop (the product is not tagged `drop`); never gated.
 * - No `start` → treat as already started; no `end` → open-ended.
 * - `start > now` → `early-access` when the visitor holds access, else `upcoming`.
 * - `end <= now` → `ended`. Otherwise `live`.
 */
export function dropState(
  drop: DropWindow | null | undefined,
  now: Date,
  hasEarlyAccess = false
): DropView | null {
  if (!drop) return null
  const start = toDropDate(drop.start)
  const end = toDropDate(drop.end)
  const maxPerOrder =
    typeof drop.maxPerOrder === 'number' && Number.isInteger(drop.maxPerOrder) && drop.maxPerOrder >= 1
      ? drop.maxPerOrder
      : null
  const time = now.getTime()

  if (end && end.getTime() <= time) {
    return { state: 'ended', start, end, maxPerOrder, nextTransitionIn: null }
  }
  if (start && start.getTime() > time) {
    return {
      state: hasEarlyAccess ? 'early-access' : 'upcoming',
      start,
      end,
      maxPerOrder,
      nextTransitionIn: start.getTime() - time,
    }
  }
  return {
    state: 'live',
    start,
    end,
    maxPerOrder,
    nextTransitionIn: end ? end.getTime() - time : null,
  }
}

/** True when the visitor may add the product to the cart in this state. */
export function isDropOpen(view: DropView | null): boolean {
  return view === null || view.state === 'live' || view.state === 'early-access'
}

/**
 * The store's merchant timezone (Shopify `shop.ianaTimezone`). Hardcoded for
 * now so a drop that "opens Sep 6 at 9 AM" reads the same for every visitor;
 * Phase 6 can read it from the `shop` query.
 */
export const DROP_TIME_ZONE = 'America/New_York'

const DATE_ONLY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: DROP_TIME_ZONE,
})
const DATE_TIME = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: DROP_TIME_ZONE,
})

/** "Sep 6" or, with `withTime`, "Sep 6, 9:00 AM" in the store's timezone. */
export function formatDropDate(date: Date, options: { withTime?: boolean } = {}): string {
  // `Intl` can emit a narrow no-break space before AM/PM; normalise so copy
  // and tests compare plainly.
  return (options.withTime ? DATE_TIME : DATE_ONLY).format(date).replace(/ /g, ' ')
}

/** "Sep 6 – Sep 12" / "From Sep 6" / "Until Sep 12" / null. */
export function formatDropWindow(view: Pick<DropView, 'start' | 'end'>): string | null {
  if (view.start && view.end) return `${formatDropDate(view.start)} – ${formatDropDate(view.end)}`
  if (view.start) return `From ${formatDropDate(view.start)}`
  if (view.end) return `Until ${formatDropDate(view.end)}`
  return null
}

export type DropCopy = { eyebrow: string; headline: string; detail: string | null }

/** The copy each state shows on the PDP, the spotlight and the drops page. */
export function dropCopy(view: DropView): DropCopy {
  switch (view.state) {
    case 'upcoming':
      return {
        eyebrow: 'Drop',
        headline: view.start ? `Opens ${formatDropDate(view.start, { withTime: true })}` : 'Opening soon',
        detail: 'Early access for members',
      }
    case 'early-access':
      return {
        eyebrow: 'Early access',
        headline: 'Yours before everyone else',
        detail: view.start ? `Opens to all ${formatDropDate(view.start, { withTime: true })}` : null,
      }
    case 'live':
      return {
        eyebrow: 'Drop',
        headline: 'Live now',
        detail: view.end ? `Until ${formatDropDate(view.end, { withTime: true })}` : null,
      }
    case 'ended':
      return { eyebrow: 'Drop', headline: 'This drop has ended', detail: null }
  }
}

/** The label the locked buy button carries while a drop is not yet open. */
export function lockedButtonLabel(view: DropView): string {
  if (view.state === 'ended') return 'Drop ended'
  return view.start ? `Opens ${formatDropDate(view.start)}` : 'Opening soon'
}

/** Refusal copy shared by the cart action, the buy box and the drawer. */
export const DROP_REFUSALS = {
  DROP_NOT_OPEN: 'This drop has not opened yet.',
  DROP_ENDED: 'This drop has ended.',
} as const

export type DropRefusalCode = keyof typeof DROP_REFUSALS

/** The refusal for a state that is not open, or `null` when the add may go ahead. */
export function dropRefusal(view: DropView | null): { code: DropRefusalCode; error: string } | null {
  if (isDropOpen(view)) return null
  if (view?.state === 'ended') return { code: 'DROP_ENDED', error: DROP_REFUSALS.DROP_ENDED }
  return { code: 'DROP_NOT_OPEN', error: DROP_REFUSALS.DROP_NOT_OPEN }
}

/** Split a duration into the units the countdown shows. */
export function countdownParts(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  }
}

const two = (n: number) => String(n).padStart(2, '0')

/** "02d 04h 09m 12s" — days are omitted once they reach zero. */
export function formatCountdown(ms: number): string {
  const { days, hours, minutes, seconds } = countdownParts(ms)
  const tail = `${two(hours)}h ${two(minutes)}m ${two(seconds)}s`
  return days > 0 ? `${two(days)}d ${tail}` : tail
}

export type DropGroups<T> = { live: T[]; upcoming: T[]; ended: T[] }

/**
 * Buckets drop products for the `/drops` page and the home spotlight. Items
 * without a window (`drop` null) count as live — they are merchandised in the
 * `drops` collection, so they are on sale. Upcoming drops sort by start,
 * soonest first; live drops by end, ending soonest first; past by end, newest first.
 */
export function groupDrops<T extends { drop?: DropWindow | null }>(items: T[], now: Date): DropGroups<T> {
  const groups: DropGroups<T> = { live: [], upcoming: [], ended: [] }
  const views = new Map<T, DropView | null>()
  for (const item of items) {
    const view = dropState(item.drop ?? null, now)
    views.set(item, view)
    if (!view || view.state === 'live') groups.live.push(item)
    else if (view.state === 'ended') groups.ended.push(item)
    else groups.upcoming.push(item)
  }
  const at = (item: T, key: 'start' | 'end', fallback: number) =>
    views.get(item)?.[key]?.getTime() ?? fallback
  groups.upcoming.sort((a, b) => at(a, 'start', Infinity) - at(b, 'start', Infinity))
  groups.live.sort((a, b) => at(a, 'end', Infinity) - at(b, 'end', Infinity))
  groups.ended.sort((a, b) => at(b, 'end', 0) - at(a, 'end', 0))
  return groups
}
