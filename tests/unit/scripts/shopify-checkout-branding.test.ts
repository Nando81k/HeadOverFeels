// tests/unit/scripts/shopify-checkout-branding.test.ts
import { describe, it, expect } from 'vitest'

import {
  CHECKOUT_BRANDING_INPUT,
  CHECKOUT_BRANDING_UPSERT_MUTATION,
  CHECKOUT_PROFILES_QUERY,
  toBrandingVariables,
} from '@/scripts/shopify/lib/checkout-branding-input'

const HEX = /^#[0-9A-F]{6}$/
const ENUM = /^[A-Z][A-Z0-9_]*$/

/** Collects every leaf value with its dotted path. */
function leaves(value: unknown, path = ''): [string, unknown][] {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      leaves(child, path ? `${path}.${key}` : key)
    )
  }
  return [[path, value]]
}

describe('CHECKOUT_BRANDING_INPUT', () => {
  it('has only the designSystem and customizations top-level keys', () => {
    expect(Object.keys(CHECKOUT_BRANDING_INPUT).sort()).toEqual(['customizations', 'designSystem'])
    expect(Object.keys(CHECKOUT_BRANDING_INPUT.designSystem).sort()).toEqual([
      'colors',
      'cornerRadius',
      'typography',
    ])
  })

  it('sets the global palette', () => {
    expect(CHECKOUT_BRANDING_INPUT.designSystem.colors.global).toEqual({
      brand: '#0A0A0A',
      accent: '#FF3131',
      success: '#1E7F4F',
      critical: '#B3261E',
    })
  })

  it('sets scheme1 base, primary button and control colours', () => {
    const scheme1 = CHECKOUT_BRANDING_INPUT.designSystem.colors.schemes.scheme1
    expect(scheme1.base).toEqual({ background: '#F7F5F2', text: '#0A0A0A' })
    expect(scheme1.primaryButton.background).toBe('#0A0A0A')
    expect(scheme1.primaryButton.text).toBe('#F7F5F2')
    expect(scheme1.primaryButton.hover.background).toBe('#3D3D3D')
    expect(scheme1.control).toMatchObject({ background: '#FFFFFF', border: '#D9D5D0' })
  })

  it('uses sharp 2px corners and the Inter / Archivo Shopify font groups', () => {
    const { cornerRadius, typography } = CHECKOUT_BRANDING_INPUT.designSystem
    expect(cornerRadius).toEqual({ base: 2, small: 2, large: 2 })
    expect(typography.primary).toEqual({ shopifyFontGroup: { name: 'Inter' } })
    expect(typography.secondary).toEqual({ shopifyFontGroup: { name: 'Archivo' } })
  })

  it('customises headings, buttons, header, thumbnails and the cart link', () => {
    const c = CHECKOUT_BRANDING_INPUT.customizations
    const heading = { typography: { font: 'SECONDARY', weight: 'BOLD', letterCase: 'UPPER' } }
    expect(c.headingLevel1).toEqual(heading)
    expect(c.headingLevel2).toEqual(heading)
    expect(c.primaryButton).toEqual({ cornerRadius: 'BASE' })
    expect(c.global).toEqual({ cornerRadius: 'NONE' })
    expect(c.header).toEqual({ alignment: 'START' })
    expect(c.merchandiseThumbnail).toEqual({ border: 'NONE' })
    expect(c.cartLink).toEqual({ visibility: 'VISIBLE' })
  })

  it('contains only uppercase 6-digit hex colours, enum strings, font names and integer radii', () => {
    for (const [path, value] of leaves(CHECKOUT_BRANDING_INPUT)) {
      if (path.startsWith('designSystem.colors.')) {
        expect(value, path).toMatch(HEX)
      } else if (path.startsWith('designSystem.cornerRadius.')) {
        expect(Number.isInteger(value), path).toBe(true)
      } else if (path.endsWith('shopifyFontGroup.name')) {
        expect(['Inter', 'Archivo'], path).toContain(value)
      } else {
        expect(path.startsWith('customizations.'), path).toBe(true)
        expect(value, path).toMatch(ENUM)
      }
    }
  })
})

describe('toBrandingVariables', () => {
  it('wraps the input with the profile id', () => {
    const id = 'gid://shopify/CheckoutProfile/123'
    expect(toBrandingVariables(id)).toEqual({
      checkoutProfileId: id,
      checkoutBrandingInput: CHECKOUT_BRANDING_INPUT,
    })
  })
})

describe('GraphQL documents', () => {
  it('lists checkout profiles with their published flag', () => {
    expect(CHECKOUT_PROFILES_QUERY).toContain('query CheckoutProfiles')
    expect(CHECKOUT_PROFILES_QUERY).toContain('checkoutProfiles(first: 5)')
    expect(CHECKOUT_PROFILES_QUERY).toContain('isPublished')
  })

  it('upserts the branding and selects userErrors', () => {
    expect(CHECKOUT_BRANDING_UPSERT_MUTATION).toContain('mutation CheckoutBrandingUpsert')
    expect(CHECKOUT_BRANDING_UPSERT_MUTATION).toContain('$checkoutProfileId: ID!')
    expect(CHECKOUT_BRANDING_UPSERT_MUTATION).toContain(
      '$checkoutBrandingInput: CheckoutBrandingInput!'
    )
    expect(CHECKOUT_BRANDING_UPSERT_MUTATION).toContain('checkoutBrandingUpsert(')
    expect(CHECKOUT_BRANDING_UPSERT_MUTATION).toMatch(/userErrors\s*{\s*field\s+message\s+code\s*}/)
  })
})
