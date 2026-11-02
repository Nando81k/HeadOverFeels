/**
 * Checkout branding for the Shopify-hosted checkout (Phase 3, Task 3).
 *
 * Mirrors the storefront look (styles/storefront/tokens.css): ink/bone palette, signal-red
 * accent, 2px corners, Inter body + Archivo uppercase headings. This file and tokens.css are
 * the only places the palette is spelled out as hex; `scripts/**` is outside the storefront
 * no-hex lint scope (eslint.config.mjs), so no override is needed.
 *
 * Every field name below was confirmed by introspecting the Admin API 2026-07 schema
 * (`CheckoutBrandingInput` and its nested input types / enums) and the full document was
 * validated against it. `checkoutProfiles` and `checkoutBrandingUpsert` are flagged deprecated
 * in favour of `checkoutAndAccountsConfiguration*`, which is not in the pinned schema yet.
 *
 * Pure data only — no I/O, so it is unit-testable without Shopify credentials.
 */

/** `CheckoutBrandingTypographyFont` */
export type TypographyFont = 'PRIMARY' | 'SECONDARY'
/** `CheckoutBrandingTypographyWeight` */
export type TypographyWeight = 'BASE' | 'BOLD'
/** `CheckoutBrandingTypographyLetterCase` */
export type TypographyLetterCase = 'LOWER' | 'NONE' | 'TITLE' | 'UPPER'
/** `CheckoutBrandingCornerRadius` */
export type CornerRadius = 'BASE' | 'LARGE' | 'NONE' | 'SMALL'
/** `CheckoutBrandingGlobalCornerRadius` */
export type GlobalCornerRadius = 'NONE'
/** `CheckoutBrandingHeaderAlignment` */
export type HeaderAlignment = 'CENTER' | 'END' | 'START'
/** `CheckoutBrandingSimpleBorder` */
export type SimpleBorder = 'FULL' | 'NONE'
/** `CheckoutBrandingVisibility` */
export type Visibility = 'HIDDEN' | 'VISIBLE'

/** `CheckoutBrandingColorRolesInput` (subset). */
export interface ColorRolesInput {
  background?: string
  text?: string
  border?: string
  accent?: string
  icon?: string
  decorative?: string
}

/** `CheckoutBrandingTypographyStyleInput` (subset). */
export interface TypographyStyleInput {
  font?: TypographyFont
  weight?: TypographyWeight
  letterCase?: TypographyLetterCase
}

/** `CheckoutBrandingInput` — the subset this script sets. */
export interface CheckoutBrandingInput {
  designSystem: {
    colors: {
      /** `CheckoutBrandingColorGlobalInput` */
      global: { brand: string; accent: string; success: string; critical: string }
      /** `CheckoutBrandingColorSchemesInput` → `CheckoutBrandingColorSchemeInput` */
      schemes: {
        scheme1: {
          base: ColorRolesInput
          /** `CheckoutBrandingButtonColorRolesInput` (`hover` is `CheckoutBrandingColorRolesInput`) */
          primaryButton: ColorRolesInput & { hover: ColorRolesInput }
          /** `CheckoutBrandingControlColorRolesInput` */
          control: ColorRolesInput
        }
      }
    }
    /** `CheckoutBrandingCornerRadiusVariablesInput` (px) */
    cornerRadius: { base: number; small: number; large: number }
    /** `CheckoutBrandingTypographyInput` → `CheckoutBrandingFontGroupInput` */
    typography: {
      primary: { shopifyFontGroup: { name: string } }
      secondary: { shopifyFontGroup: { name: string } }
    }
  }
  /** `CheckoutBrandingCustomizationsInput` */
  customizations: {
    headingLevel1: { typography: TypographyStyleInput }
    headingLevel2: { typography: TypographyStyleInput }
    /** `CheckoutBrandingButtonInput` */
    primaryButton: { cornerRadius: CornerRadius }
    /** `CheckoutBrandingGlobalInput` */
    global: { cornerRadius: GlobalCornerRadius }
    /** `CheckoutBrandingHeaderInput` */
    header: { alignment: HeaderAlignment }
    /** `CheckoutBrandingMerchandiseThumbnailInput` */
    merchandiseThumbnail: { border: SimpleBorder }
    /** `CheckoutBrandingCartLinkInput` */
    cartLink: { visibility: Visibility }
  }
}

const INK = '#0A0A0A'
const BONE = '#F7F5F2'

const DISPLAY_HEADING: { typography: TypographyStyleInput } = {
  typography: { font: 'SECONDARY', weight: 'BOLD', letterCase: 'UPPER' },
}

export const CHECKOUT_BRANDING_INPUT: CheckoutBrandingInput = {
  designSystem: {
    colors: {
      global: {
        brand: INK,
        accent: '#FF3131',
        success: '#1E7F4F',
        critical: '#B3261E',
      },
      schemes: {
        scheme1: {
          base: { background: BONE, text: INK },
          primaryButton: {
            background: INK,
            text: BONE,
            hover: { background: '#3D3D3D' },
          },
          // `--color-line` is an rgba in tokens.css; checkout needs an opaque hex.
          control: { background: '#FFFFFF', border: '#D9D5D0' },
        },
      },
    },
    cornerRadius: { base: 2, small: 2, large: 2 },
    typography: {
      primary: { shopifyFontGroup: { name: 'Inter' } },
      secondary: { shopifyFontGroup: { name: 'Archivo' } },
    },
  },
  customizations: {
    headingLevel1: DISPLAY_HEADING,
    headingLevel2: DISPLAY_HEADING,
    primaryButton: { cornerRadius: 'BASE' },
    global: { cornerRadius: 'NONE' },
    header: { alignment: 'START' },
    merchandiseThumbnail: { border: 'NONE' },
    cartLink: { visibility: 'VISIBLE' },
  },
}

/** Variables for `CHECKOUT_BRANDING_UPSERT_MUTATION`. */
export function toBrandingVariables(profileId: string): {
  checkoutProfileId: string
  checkoutBrandingInput: CheckoutBrandingInput
} {
  return { checkoutProfileId: profileId, checkoutBrandingInput: CHECKOUT_BRANDING_INPUT }
}

export const CHECKOUT_PROFILES_QUERY = /* GraphQL */ `
  query CheckoutProfiles {
    checkoutProfiles(first: 5) {
      nodes {
        id
        name
        isPublished
      }
    }
  }
`

export interface CheckoutProfilesResponse {
  checkoutProfiles: { nodes: { id: string; name: string; isPublished: boolean }[] }
}

export const CHECKOUT_BRANDING_UPSERT_MUTATION = /* GraphQL */ `
  mutation CheckoutBrandingUpsert(
    $checkoutProfileId: ID!
    $checkoutBrandingInput: CheckoutBrandingInput!
  ) {
    checkoutBrandingUpsert(
      checkoutProfileId: $checkoutProfileId
      checkoutBrandingInput: $checkoutBrandingInput
    ) {
      checkoutBranding {
        designSystem {
          colors {
            global {
              brand
              accent
            }
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

export interface CheckoutBrandingUpsertResponse {
  checkoutBrandingUpsert: {
    checkoutBranding: {
      designSystem: { colors: { global: { brand: string | null; accent: string | null } } } | null
    } | null
    userErrors: { field?: string[] | null; message: string; code?: string | null }[]
  }
}
