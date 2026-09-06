import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../../..')
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8')

const STOREFRONT_TOKENS = [
  // Colour
  '--color-ink',
  '--color-ink-soft',
  '--color-ink-mute',
  '--color-bone',
  '--color-paper',
  '--color-line',
  '--color-line-strong',
  '--color-signal',
  '--color-signal-ink',
  '--color-rose',
  '--color-rose-tint',
  '--color-ok',
  '--color-warn',
  '--color-danger',
  // Type
  '--font-display',
  '--font-body',
  '--font-mono',
  '--text-display-xl',
  '--text-display-lg',
  '--text-display-md',
  '--tracking-display',
  '--tracking-eyebrow',
  // Space & shape
  '--spacing-gutter',
  '--spacing-section',
  '--container-shop',
  '--radius-sharp',
  '--radius-pill',
  // Motion
  '--duration-sf-fast',
  '--duration-sf-base',
  '--duration-sf-slow',
  '--ease-sf-out',
  '--ease-sf-spring',
]

/** All custom-property names *defined* (i.e. `--name:`) in a CSS source. */
function definedCustomProperties(css: string): Set<string> {
  const names = new Set<string>()
  const re = /(--[a-zA-Z0-9_-]+)\s*:/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) names.add(m[1])
  return names
}

describe('storefront tokens', () => {
  const storefrontCss = read('styles/storefront/tokens.css')
  const adminCss = read('styles/admin/tokens.css')

  it('defines every token from spec §5.1 (with the documented renames)', () => {
    const defined = definedCustomProperties(storefrontCss)
    const missing = STOREFRONT_TOKENS.filter((t) => !defined.has(t))
    expect(missing).toEqual([])
  })

  it('declares the tokens inside an @theme block', () => {
    expect(storefrontCss).toMatch(/@theme\s*\{/)
  })

  it('keeps the admin/legacy tokens intact after the move', () => {
    for (const token of [
      '--color-surface-base',
      '--color-border-subtle',
      '--shadow-glow-primary',
      '--color-primary',
      '--color-background',
      '--color-muted-foreground',
      '--font-logo',
    ]) {
      expect(adminCss).toContain(`${token}:`)
    }
  })

  it('shares no theme-namespaced token name between the admin and storefront files', () => {
    const namespaced = (css: string) =>
      [...definedCustomProperties(css)].filter((n) =>
        /^--(color|radius|duration|ease|font)-/.test(n)
      )
    const adminNames = new Set(namespaced(adminCss))
    const collisions = namespaced(storefrontCss).filter((n) => adminNames.has(n))
    expect(collisions).toEqual([])
  })
})

describe('app/globals.css', () => {
  it('contains only the tailwind import plus the three style imports', () => {
    const lines = read('app/globals.css')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('/*') && !l.startsWith('*') && !l.startsWith('//'))

    expect(lines).toEqual([
      '@import "tailwindcss";',
      '@import "../styles/admin/tokens.css";',
      '@import "../styles/storefront/tokens.css";',
      '@import "../styles/storefront/base.css";',
    ])
  })

  it('points at files that exist', () => {
    for (const rel of [
      'styles/admin/tokens.css',
      'styles/storefront/tokens.css',
      'styles/storefront/base.css',
    ]) {
      expect(fs.existsSync(path.join(root, rel))).toBe(true)
    }
  })
})

describe('storefront base styles', () => {
  const baseCss = read('styles/storefront/base.css')

  it('scopes its rules to [data-surface="storefront"]', () => {
    expect(baseCss).toContain('[data-surface="storefront"]')
    expect(baseCss).toMatch(/@layer\s+base/)
  })

  it('sets the focus ring, selection and reduced-motion kill switch', () => {
    expect(baseCss).toContain('*:focus-visible')
    expect(baseCss).toContain('::selection')
    expect(baseCss).toContain('prefers-reduced-motion: reduce')
  })

  it('defines the tabular-numeral .num utility', () => {
    expect(baseCss).toMatch(/(@utility\s+num|\.num)\s*\{/)
    expect(baseCss).toContain('font-variant-numeric: tabular-nums')
  })
})

describe('no hex literals in storefront components', () => {
  function walk(dir: string): string[] {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name)
      return entry.isDirectory() ? walk(full) : [full]
    })
  }

  it('finds no #rrggbb literal under components/storefront', () => {
    const offenders = walk(path.join(root, 'components/storefront')).filter((file) =>
      /#[0-9a-fA-F]{6}\b/.test(fs.readFileSync(file, 'utf8'))
    )
    expect(offenders).toEqual([])
  })
})
