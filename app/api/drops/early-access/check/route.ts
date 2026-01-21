import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/prisma'
import { EarlyAccessGrant, LoyaltyTier, EarlyAccessType } from '@prisma/client'

// Extended types for includes
interface EarlyAccessConfig {
  id: string
  productId: string
  loyaltyTierId: string | null
  startDate: Date
  endDate: Date
  pointsCost: number
  isActive: boolean
  loyaltyTier: LoyaltyTier | null
}

// Check if a user has early access to a specific drop
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    
    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    }
    
    // Try NextAuth session first
    const session = await auth()
    let customerId: string | null = null
    
    if (session?.user?.id) {
      customerId = session.user.id
    } else {
      // Fall back to cookie-based session
      const sessionId = request.cookies.get('auth_session')?.value
      if (sessionId) {
        customerId = sessionId
      }
    }
    
    // If not logged in, no early access
    if (!customerId) {
      return NextResponse.json({
        hasAccess: false,
        reason: 'not_authenticated',
        canUnlock: false,
        pointsCost: null
      })
    }
    
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        loyaltyTier: true,
        earlyAccessGrants: {
          where: { productId }
        }
      }
    })
    
    if (!customer) {
      return NextResponse.json({
        hasAccess: false,
        reason: 'customer_not_found',
        canUnlock: false,
        pointsCost: null
      })
    }
    
    // Get the product and its early access configuration
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        earlyAccessConfigs: {
          where: { isActive: true },
          include: { loyaltyTier: true },
          orderBy: { startDate: 'asc' }
        }
      }
    })
    
    if (!product || !product.isLimitedEdition) {
      return NextResponse.json({
        hasAccess: false,
        reason: 'not_limited_drop',
        canUnlock: false,
        pointsCost: null
      })
    }
    
    const now = new Date()
    
    // Check if user already has a grant (from redemption or auto-grant)
    const existingGrant = customer.earlyAccessGrants.find((g: EarlyAccessGrant) => 
      g.productId === productId && g.validUntil > now
    )
    
    if (existingGrant) {
      return NextResponse.json({
        hasAccess: true,
        reason: existingGrant.grantType === EarlyAccessType.POINTS_REDEMPTION ? 'points_unlock' : 'tier_benefit',
        grantId: existingGrant.id,
        validUntil: existingGrant.validUntil,
        canUnlock: false,
        pointsCost: null
      })
    }
    
    // Check if the user's tier has early access during current window
    const userTierSlug = customer.loyaltyTier?.slug
    const userHasEarlyAccessBenefit = customer.loyaltyTier?.earlyDropAccess || false
    
    // Find applicable early access config for user's tier
    const applicableConfig = (product.earlyAccessConfigs as EarlyAccessConfig[]).find((config: EarlyAccessConfig) => {
      // Check if this config is for the user's specific tier
      if (config.loyaltyTierId && config.loyaltyTier?.slug === userTierSlug) {
        return config.startDate <= now && config.endDate > now
      }
      // Or if it's a general config for tiers with earlyDropAccess
      if (!config.loyaltyTierId && userHasEarlyAccessBenefit) {
        return config.startDate <= now && config.endDate > now
      }
      return false
    })
    
    if (applicableConfig) {
      // Auto-grant access for tier benefit
      const grant = await prisma.earlyAccessGrant.create({
        data: {
          customerId: customer.id,
          productId: productId,
          grantType: EarlyAccessType.TIER_BENEFIT,
          validUntil: applicableConfig.endDate
        }
      })
      
      return NextResponse.json({
        hasAccess: true,
        reason: 'tier_benefit',
        grantId: grant.id,
        validUntil: grant.validUntil,
        tierName: customer.loyaltyTier?.name,
        canUnlock: false,
        pointsCost: null
      })
    }
    
    // Check if there's an active early access period that user can unlock
    const unlockableConfig = (product.earlyAccessConfigs as EarlyAccessConfig[]).find((config: EarlyAccessConfig) => 
      config.startDate <= now && config.endDate > now && config.pointsCost > 0
    )
    
    if (unlockableConfig) {
      return NextResponse.json({
        hasAccess: false,
        reason: 'tier_required',
        canUnlock: true,
        pointsCost: unlockableConfig.pointsCost,
        configId: unlockableConfig.id,
        earlyAccessEnds: unlockableConfig.endDate,
        currentPoints: customer.currentPoints,
        hasEnoughPoints: customer.currentPoints >= unlockableConfig.pointsCost
      })
    }
    
    // Check if drop is in public release phase
    if (product.releaseDate && product.releaseDate <= now) {
      if (!product.dropEndDate || product.dropEndDate > now) {
        return NextResponse.json({
          hasAccess: true,
          reason: 'public_release',
          canUnlock: false,
          pointsCost: null
        })
      }
    }
    
    // Check upcoming early access
    const upcomingConfig = (product.earlyAccessConfigs as EarlyAccessConfig[]).find((config: EarlyAccessConfig) => 
      config.startDate > now
    )
    
    return NextResponse.json({
      hasAccess: false,
      reason: 'not_available',
      canUnlock: false,
      pointsCost: null,
      publicReleaseDate: product.releaseDate,
      earlyAccessStartDate: upcomingConfig?.startDate || null
    })
    
  } catch (error) {
    console.error('Error checking early access:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
