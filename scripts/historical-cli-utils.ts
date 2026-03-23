export interface HistoricalCliArgs {
  scale?: string
  from?: string
  to?: string
  seed?: number
  confirmReset?: string
}

function readArgValue(name: string): string | undefined {
  const arg = `--${name}`
  const index = process.argv.indexOf(arg)
  if (index === -1) {
    return undefined
  }
  return process.argv[index + 1]
}

export function parseHistoricalCliArgs(): HistoricalCliArgs {
  const scale = readArgValue('scale')
  const from = readArgValue('from')
  const to = readArgValue('to')
  const seedRaw = readArgValue('seed')
  const confirmReset = readArgValue('confirm-reset')

  return {
    scale,
    from,
    to,
    seed: seedRaw ? Number(seedRaw) : undefined,
    confirmReset,
  }
}

export function printHistoricalUsage(scriptName: string): void {
  console.log(`Usage: npx tsx scripts/${scriptName} [options]`)
  console.log('')
  console.log('Options:')
  console.log('  --scale <light|medium|large>      Seed volume profile (default: large)')
  console.log('  --from <YYYY-MM-DD>               Seed window start date')
  console.log('  --to <YYYY-MM-DD>                 Seed window end date')
  console.log('  --seed <number>                   Deterministic RNG seed')
  if (scriptName.includes('reset')) {
    console.log("  --confirm-reset YES_RESET_DATABASE Required safety confirmation for destructive reset")
  }
}
