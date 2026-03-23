export interface TierTheme {
  primaryColor: string
  secondaryColor: string
}

const FALLBACK_TIER_THEME: TierTheme = {
  primaryColor: '#64748B',
  secondaryColor: '#475569',
}

export const DEFAULT_TIER_THEMES: Record<string, TierTheme> = {
  newcomer: { primaryColor: '#94A3B8', secondaryColor: '#475569' },
  friend: { primaryColor: '#2563EB', secondaryColor: '#3730A3' },
  bestie: { primaryColor: '#EC4899', secondaryColor: '#BE185D' },
  soulmate: { primaryColor: '#8B5CF6', secondaryColor: '#6D28D9' },
  head: { primaryColor: '#94A3B8', secondaryColor: '#475569' },
  heart: { primaryColor: '#EC4899', secondaryColor: '#BE185D' },
  mind: { primaryColor: '#2563EB', secondaryColor: '#3730A3' },
}

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function expandHexColor(value: string): string {
  if (value.length !== 4) return value

  const r = value[1]
  const g = value[2]
  const b = value[3]
  return `#${r}${r}${g}${g}${b}${b}`
}

export function normalizeTierColor(color: unknown, fallback: string): string {
  if (typeof color !== 'string') return fallback

  const trimmed = color.trim()
  if (!HEX_COLOR_REGEX.test(trimmed)) return fallback

  return expandHexColor(trimmed).toUpperCase()
}

export function getDefaultTierTheme(slug: string | null | undefined): TierTheme {
  if (!slug) return FALLBACK_TIER_THEME
  return DEFAULT_TIER_THEMES[slug.toLowerCase()] || FALLBACK_TIER_THEME
}

export function resolveTierTheme(
  slug: string | null | undefined,
  override: Partial<TierTheme> | null | undefined
): TierTheme {
  const defaults = getDefaultTierTheme(slug)
  return {
    primaryColor: normalizeTierColor(override?.primaryColor, defaults.primaryColor),
    secondaryColor: normalizeTierColor(override?.secondaryColor, defaults.secondaryColor),
  }
}

export function buildTierGradient(theme: TierTheme, angle = 135): string {
  const safeAngle = Number.isFinite(angle) ? angle : 135
  return `linear-gradient(${safeAngle}deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`
}

export function hexToRgba(hexColor: string, alpha: number): string {
  const normalized = normalizeTierColor(hexColor, FALLBACK_TIER_THEME.primaryColor).slice(1)
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  const clampedAlpha = Math.max(0, Math.min(1, alpha))
  return `rgba(${red}, ${green}, ${blue}, ${clampedAlpha})`
}

export function buildTierGlowShadow(theme: TierTheme): string {
  return `0 28px 65px -22px ${hexToRgba(theme.secondaryColor, 0.6)}`
}
