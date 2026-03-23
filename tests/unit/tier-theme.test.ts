import { describe, expect, it } from 'vitest'
import {
  buildTierGradient,
  getDefaultTierTheme,
  hexToRgba,
  normalizeTierColor,
  resolveTierTheme,
} from '@/lib/loyalty/tier-theme'

describe('tier theme helpers', () => {
  it('returns deterministic defaults for known slugs', () => {
    expect(getDefaultTierTheme('friend')).toEqual({
      primaryColor: '#2563EB',
      secondaryColor: '#3730A3',
    })
  })

  it('normalizes valid hex colors and falls back for invalid values', () => {
    expect(normalizeTierColor('#abc', '#000000')).toBe('#AABBCC')
    expect(normalizeTierColor('#12AF9D', '#000000')).toBe('#12AF9D')
    expect(normalizeTierColor('not-a-color', '#123456')).toBe('#123456')
  })

  it('resolves tier theme with override values when provided', () => {
    expect(resolveTierTheme('bestie', { primaryColor: '#111111' })).toEqual({
      primaryColor: '#111111',
      secondaryColor: '#BE185D',
    })
  })

  it('builds gradient and rgba strings from normalized colors', () => {
    const theme = resolveTierTheme('newcomer', { primaryColor: '#778899', secondaryColor: '#112233' })

    expect(buildTierGradient(theme, 120)).toBe('linear-gradient(120deg, #778899 0%, #112233 100%)')
    expect(hexToRgba('#112233', 0.4)).toBe('rgba(17, 34, 51, 0.4)')
  })
})
