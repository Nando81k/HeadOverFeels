// tests/unit/storefront/drops.test.ts — lib/storefront/drops.ts (Phase 5, Task 1)
import { describe, expect, it } from 'vitest'
import {
  countdownParts,
  dropCopy,
  dropRefusal,
  dropState,
  formatCountdown,
  formatDropDate,
  formatDropWindow,
  groupDrops,
  isDropOpen,
  lockedButtonLabel,
  toDropDate,
} from '@/lib/storefront/drops'

const NOW = new Date('2026-09-10T12:00:00Z')
const BEFORE = '2026-09-06T13:00:00Z' // Sep 6, 9:00 AM New York
const AFTER = '2026-09-13T13:00:00Z'
const LATER = '2026-09-20T13:00:00Z'

describe('toDropDate', () => {
  it('parses ISO strings and treats missing or invalid values as unset', () => {
    expect(toDropDate(BEFORE)?.toISOString()).toBe('2026-09-06T13:00:00.000Z')
    expect(toDropDate(null)).toBeNull()
    expect(toDropDate('')).toBeNull()
    expect(toDropDate('not a date')).toBeNull()
  })
})

describe('dropState', () => {
  it('is null for a product that is not a drop', () => {
    expect(dropState(null, NOW)).toBeNull()
    expect(dropState(undefined, NOW)).toBeNull()
  })

  it('is live between start and end, counting down to the end', () => {
    const view = dropState({ start: BEFORE, end: AFTER }, NOW)
    expect(view?.state).toBe('live')
    expect(view?.nextTransitionIn).toBe(new Date(AFTER).getTime() - NOW.getTime())
  })

  it('is live and open-ended without an end, and without a start once there is no future start', () => {
    expect(dropState({ start: BEFORE, end: null }, NOW)).toMatchObject({ state: 'live', nextTransitionIn: null })
    expect(dropState({ start: null, end: null }, NOW)).toMatchObject({ state: 'live', nextTransitionIn: null })
    expect(dropState({ start: null, end: AFTER }, NOW)?.state).toBe('live')
  })

  it('is upcoming before the start, early-access for a visitor with access', () => {
    const upcoming = dropState({ start: AFTER, end: LATER }, NOW)
    expect(upcoming?.state).toBe('upcoming')
    expect(upcoming?.nextTransitionIn).toBe(new Date(AFTER).getTime() - NOW.getTime())

    expect(dropState({ start: AFTER, end: LATER }, NOW, true)?.state).toBe('early-access')
  })

  it('is ended once the end has passed, whatever the access', () => {
    const ended = dropState({ start: BEFORE, end: '2026-09-10T12:00:00Z' }, NOW, true)
    expect(ended).toMatchObject({ state: 'ended', nextTransitionIn: null })
  })

  it('treats invalid dates as unset', () => {
    expect(dropState({ start: 'soon', end: 'later' }, NOW)?.state).toBe('live')
  })

  it('keeps a valid max per order and drops a bad one', () => {
    expect(dropState({ start: null, end: null, maxPerOrder: 2 }, NOW)?.maxPerOrder).toBe(2)
    expect(dropState({ start: null, end: null, maxPerOrder: 0 }, NOW)?.maxPerOrder).toBeNull()
    expect(dropState({ start: null, end: null }, NOW)?.maxPerOrder).toBeNull()
  })
})

describe('isDropOpen / dropRefusal', () => {
  it('opens for non-drops, live and early access; refuses upcoming and ended', () => {
    expect(isDropOpen(null)).toBe(true)
    expect(isDropOpen(dropState({ start: BEFORE, end: AFTER }, NOW))).toBe(true)
    expect(isDropOpen(dropState({ start: AFTER, end: null }, NOW, true))).toBe(true)
    expect(isDropOpen(dropState({ start: AFTER, end: null }, NOW))).toBe(false)
    expect(isDropOpen(dropState({ start: null, end: BEFORE }, NOW))).toBe(false)
  })

  it('names the refusal', () => {
    expect(dropRefusal(null)).toBeNull()
    expect(dropRefusal(dropState({ start: AFTER, end: null }, NOW))).toEqual({
      code: 'DROP_NOT_OPEN',
      error: 'This drop has not opened yet.',
    })
    expect(dropRefusal(dropState({ start: null, end: BEFORE }, NOW))).toEqual({
      code: 'DROP_ENDED',
      error: 'This drop has ended.',
    })
  })
})

describe('formatting', () => {
  it('formats dates in the store timezone', () => {
    expect(formatDropDate(new Date(BEFORE))).toBe('Sep 6')
    expect(formatDropDate(new Date(BEFORE), { withTime: true })).toBe('Sep 6, 9:00 AM')
  })

  it('formats the window', () => {
    expect(formatDropWindow({ start: new Date(BEFORE), end: new Date(AFTER) })).toBe('Sep 6 – Sep 13')
    expect(formatDropWindow({ start: new Date(BEFORE), end: null })).toBe('From Sep 6')
    expect(formatDropWindow({ start: null, end: new Date(AFTER) })).toBe('Until Sep 13')
    expect(formatDropWindow({ start: null, end: null })).toBeNull()
  })

  it('writes the copy for each state', () => {
    expect(dropCopy(dropState({ start: AFTER, end: null }, NOW)!)).toEqual({
      eyebrow: 'Drop',
      headline: 'Opens Sep 13, 9:00 AM',
      detail: 'Early access for members',
    })
    expect(dropCopy(dropState({ start: AFTER, end: null }, NOW, true)!)).toEqual({
      eyebrow: 'Early access',
      headline: 'Yours before everyone else',
      detail: 'Opens to all Sep 13, 9:00 AM',
    })
    expect(dropCopy(dropState({ start: BEFORE, end: AFTER }, NOW)!)).toEqual({
      eyebrow: 'Drop',
      headline: 'Live now',
      detail: 'Until Sep 13, 9:00 AM',
    })
    expect(dropCopy(dropState({ start: BEFORE, end: null }, NOW)!).detail).toBeNull()
    expect(dropCopy(dropState({ start: null, end: BEFORE }, NOW)!)).toEqual({
      eyebrow: 'Drop',
      headline: 'This drop has ended',
      detail: null,
    })
  })

  it('labels the locked button', () => {
    expect(lockedButtonLabel(dropState({ start: AFTER, end: null }, NOW)!)).toBe('Opens Sep 13')
    expect(lockedButtonLabel(dropState({ start: null, end: BEFORE }, NOW)!)).toBe('Drop ended')
  })

  it('splits and formats a countdown', () => {
    const ms = ((2 * 24 + 4) * 3600 + 9 * 60 + 12) * 1000
    expect(countdownParts(ms)).toEqual({ days: 2, hours: 4, minutes: 9, seconds: 12 })
    expect(formatCountdown(ms)).toBe('02d 04h 09m 12s')
    expect(formatCountdown(65_000)).toBe('00h 01m 05s')
    expect(formatCountdown(-5)).toBe('00h 00m 00s')
  })
})

describe('groupDrops', () => {
  const item = (handle: string, drop: { start: string | null; end: string | null } | null) => ({ handle, drop })

  it('buckets by state and sorts each bucket', () => {
    const groups = groupDrops(
      [
        item('ended-old', { start: null, end: '2026-08-01T00:00:00Z' }),
        item('later', { start: LATER, end: null }),
        item('live-open', { start: BEFORE, end: null }),
        item('soon', { start: AFTER, end: LATER }),
        item('no-window', null),
        item('live-closing', { start: BEFORE, end: AFTER }),
        item('ended-new', { start: null, end: '2026-09-01T00:00:00Z' }),
      ],
      NOW
    )

    expect(groups.live.map((i) => i.handle)).toEqual(['live-closing', 'live-open', 'no-window'])
    expect(groups.upcoming.map((i) => i.handle)).toEqual(['soon', 'later'])
    expect(groups.ended.map((i) => i.handle)).toEqual(['ended-new', 'ended-old'])
  })

  it('returns empty buckets for no items', () => {
    expect(groupDrops([], NOW)).toEqual({ live: [], upcoming: [], ended: [] })
  })
})
