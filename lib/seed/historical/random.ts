export interface SeedRng {
  next(): number
  int(minInclusive: number, maxInclusive: number): number
  float(minInclusive: number, maxExclusive: number): number
  bool(probability?: number): boolean
  pick<T>(values: readonly T[]): T
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createSeedRng(seed: number): SeedRng {
  const next = mulberry32(seed)

  return {
    next,
    int(minInclusive, maxInclusive) {
      const min = Math.ceil(minInclusive)
      const max = Math.floor(maxInclusive)
      if (max <= min) {
        return min
      }

      return Math.floor(next() * (max - min + 1)) + min
    },
    float(minInclusive, maxExclusive) {
      if (maxExclusive <= minInclusive) {
        return minInclusive
      }

      return next() * (maxExclusive - minInclusive) + minInclusive
    },
    bool(probability = 0.5) {
      return next() < probability
    },
    pick<T>(values: readonly T[]) {
      if (values.length === 0) {
        throw new Error('Cannot pick from an empty array')
      }

      return values[this.int(0, values.length - 1)]
    },
  }
}

export function sampleWithoutReplacement<T>(
  rng: SeedRng,
  values: readonly T[],
  count: number
): T[] {
  if (count <= 0 || values.length === 0) {
    return []
  }

  const targetCount = Math.min(count, values.length)
  const pool = [...values]
  const result: T[] = []

  for (let i = 0; i < targetCount; i += 1) {
    const index = rng.int(0, pool.length - 1)
    result.push(pool[index])
    pool.splice(index, 1)
  }

  return result
}

export function randomDateBetween(rng: SeedRng, from: Date, to: Date): Date {
  const start = from.getTime()
  const end = to.getTime()
  if (end <= start) {
    return new Date(start)
  }

  const timestamp = Math.floor(rng.float(start, end))
  return new Date(timestamp)
}
