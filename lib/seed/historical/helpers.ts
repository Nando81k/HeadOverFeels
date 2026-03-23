export function createSeedId(prefix: string, index: number, width = 6): string {
  return `${prefix}-${String(index).padStart(width, '0')}`
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function chunk<T>(items: readonly T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) {
    return [Array.from(items)]
  }

  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }
  return chunks
}

export async function runInChunks<T>(
  items: readonly T[],
  chunkSize: number,
  handler: (chunkItems: readonly T[], chunkIndex: number) => Promise<void>
): Promise<void> {
  const chunks = chunk(items, chunkSize)
  for (let index = 0; index < chunks.length; index += 1) {
    await handler(chunks[index], index)
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}
