import { SeedRng, randomDateBetween } from './random'

export interface MonthBucket {
  key: string
  start: Date
  end: Date
  weight: number
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0))
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 0, 0, 0, 0))
}

function formatMonthKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function buildMonthBuckets(from: Date, to: Date): MonthBucket[] {
  const fromUtc = new Date(from)
  const toUtc = new Date(to)

  if (fromUtc >= toUtc) {
    return []
  }

  const monthStarts: Date[] = []
  let cursor = startOfMonth(fromUtc)
  const endExclusive = addMonths(startOfMonth(toUtc), 1)

  while (cursor < endExclusive) {
    monthStarts.push(cursor)
    cursor = addMonths(cursor, 1)
  }

  return monthStarts.map((monthStart, index) => {
    const next = addMonths(monthStart, 1)
    const boundedStart = index === 0 && fromUtc > monthStart ? fromUtc : monthStart
    const boundedEnd = next > toUtc ? toUtc : next
    return {
      key: formatMonthKey(monthStart),
      start: boundedStart,
      end: boundedEnd,
      weight: 1,
    }
  })
}

export function applyGrowthAndSeasonality(months: MonthBucket[]): MonthBucket[] {
  if (months.length === 0) {
    return []
  }

  const total = months.length

  return months.map((bucket, index) => {
    const progress = index / Math.max(1, total - 1)
    const month = bucket.start.getUTCMonth()

    let seasonality = 1
    if (month === 10) seasonality = 1.35 // November
    if (month === 11) seasonality = 1.5 // December
    if (month === 0) seasonality = 1.18 // January
    if (month === 6) seasonality = 0.92 // July

    const growth = 0.7 + progress * 0.9

    return {
      ...bucket,
      weight: Math.max(0.05, growth * seasonality),
    }
  })
}

export function allocateWeightedCounts(total: number, weights: readonly number[]): number[] {
  if (total <= 0 || weights.length === 0) {
    return new Array(weights.length).fill(0)
  }

  const sanitized = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0))
  const sum = sanitized.reduce((acc, value) => acc + value, 0)
  if (sum <= 0) {
    const baseline = Math.floor(total / weights.length)
    const remainder = total - baseline * weights.length
    return sanitized.map((_, index) => (index < remainder ? baseline + 1 : baseline))
  }

  const exact = sanitized.map((weight) => (weight / sum) * total)
  const floorValues = exact.map((value) => Math.floor(value))
  const floorSum = floorValues.reduce((acc, value) => acc + value, 0)
  const remaining = total - floorSum

  const order = exact
    .map((value, index) => ({ index, remainder: value - floorValues[index] }))
    .sort((a, b) => b.remainder - a.remainder)

  for (let i = 0; i < remaining; i += 1) {
    floorValues[order[i % order.length].index] += 1
  }

  return floorValues
}

export function randomDateFromMonthBucket(rng: SeedRng, bucket: MonthBucket): Date {
  return randomDateBetween(rng, bucket.start, bucket.end)
}
