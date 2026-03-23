export interface MentalHealthQuote {
  text: string
  author?: string
}

const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000

export const MENTAL_HEALTH_QUOTES: readonly MentalHealthQuote[] = [
  { text: 'Healing is not linear, and that is okay.', author: 'Head Over Feels' },
  { text: 'Rest is productive when your mind needs care.', author: 'Head Over Feels' },
  { text: 'You can feel deeply and still move forward.', author: 'Head Over Feels' },
  { text: 'Small steps still count as progress.', author: 'Head Over Feels' },
  { text: 'Your feelings are valid, even when they are hard.', author: 'Head Over Feels' },
  { text: 'Being kind to yourself is a strength.', author: 'Head Over Feels' },
  { text: 'Today, breathe first and solve second.', author: 'Head Over Feels' },
  { text: 'Growth often looks quiet before it looks obvious.', author: 'Head Over Feels' },
  { text: 'You are allowed to pause without giving up.', author: 'Head Over Feels' },
  { text: 'Protecting your peace is part of your progress.', author: 'Head Over Feels' },
  { text: 'You deserve the same compassion you give others.', author: 'Head Over Feels' },
  { text: 'Even on tough days, you are still moving forward.', author: 'Head Over Feels' },
]

function toPositiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function getLocalDaySeed(date: Date): number {
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor(localMidnight.getTime() / MILLISECONDS_IN_DAY)
}

export function getDailyMentalHealthQuote(date: Date = new Date()): MentalHealthQuote {
  const quoteIndex = toPositiveModulo(getLocalDaySeed(date), MENTAL_HEALTH_QUOTES.length)
  return MENTAL_HEALTH_QUOTES[quoteIndex]
}

export function getMsUntilNextLocalMidnight(now: Date = new Date()): number {
  const nextLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const diff = nextLocalMidnight.getTime() - now.getTime()

  if (!Number.isFinite(diff) || diff <= 0) {
    return 1000
  }

  return Math.min(diff, MILLISECONDS_IN_DAY)
}
