'use client'

import { useMemo } from 'react'
import { useAuth } from '@/lib/auth/context'
import {
  buildTierGradient,
  hexToRgba,
  resolveTierTheme,
} from '@/lib/loyalty/tier-theme'

export interface TierAccent {
  accent: string
  accentDark: string
  accentSoft: string
  accentBorder: string
  gradient: string
  isTier: boolean
  tierName: string | null
  tierSlug: string | null
}

const GUEST_ACCENT: TierAccent = {
  accent: '#000000',
  accentDark: '#000000',
  accentSoft: 'rgba(0, 0, 0, 0.06)',
  accentBorder: 'rgba(0, 0, 0, 0.15)',
  gradient: 'linear-gradient(135deg, #000000 0%, #000000 100%)',
  isTier: false,
  tierName: null,
  tierSlug: null,
}

export function useTierAccent(): TierAccent {
  const { user } = useAuth()

  return useMemo(() => {
    const tier = user?.loyaltyTier
    if (!tier) return GUEST_ACCENT

    const theme = resolveTierTheme(tier.slug, {
      primaryColor: tier.primaryColor,
      secondaryColor: tier.secondaryColor,
    })

    return {
      accent: theme.primaryColor,
      accentDark: theme.secondaryColor,
      accentSoft: hexToRgba(theme.primaryColor, 0.12),
      accentBorder: hexToRgba(theme.primaryColor, 0.35),
      gradient: buildTierGradient(theme),
      isTier: true,
      tierName: tier.name,
      tierSlug: tier.slug,
    }
  }, [user?.loyaltyTier])
}
