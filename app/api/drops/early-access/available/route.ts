import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/prisma'
import { EarlyAccessGrant, EarlyAccessType, Product, ProductVariant, LoyaltyTier } from '@prisma/client'

// Extended types for includes
interface EarlyAccessConfig {
  id: string
  productId: string
  loyaltyTierId: string | null
  startDate: Date
  endDate: Date
  pointsCost: number
  isActive: boolean
  loyaltyTier: Pick<LoyaltyTier, 'id' | 'name' | 'slug'> | null
}

interface DropWithEarlyAccess extends Product {
  earlyAccessConfigs: EarlyAccessConfig[]
  variants: Pick<ProductVariant, 'id' | 'inventory'>[]
}

// Get all drops with active early access periods that user can potentially unlock
export async function GET(request: NextRequest) {
  try {
    // Try NextAuth session first
    const session = await auth()
    let customerId: string | null = null
    
    if (session?.user?.id) {
      customerId = session.user.id
    } else {
      // Fall back to cookie-based session
      const sessionIdCookie = request.cookies.get('auth_session')?.value
      if (sessionIdCookie) {
        customerId = sessionIdCookie
      }
    }
    
    if (!customerId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        loyaltyTier: true,
        earlyAccessGrants: {
          where: {
            validUntil: { gt: new Date() }
          }
        }
      }
    })
    
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    
    const now = new Date()
    
    // Find all products with active early access windows
    const dropsWithEarlyAccess = await prisma.product.findMany({
      where: {
        isLimitedEdition: true,
        isActive: true,
        earlyAccessConfigs: {
          some: {
            isActive: true,
            startDate: { lte: now },
            endDate: { gt: now }
          }
        }
      },
      include: {
        earlyAccessConfigs: {
          where: {
            isActive: true,
            startDate: { lte: now },
            endDate: { gt: now }
          },
          include: {
            loyaltyTier: {
              select: { id: true, name: true, slug: true }
            }
          }
        },
        variants: {
          select: {
            id: true,
            inventory: true
          }
        }
      }
    }) as DropWithEarlyAccess[]
    
    // Process each drop to determine user's access status
    const drops = dropsWithEarlyAccess.map((drop: DropWithEarlyAccess) => {
      const existingGrant = customer.earlyAccessGrants.find((g: EarlyAccessGrant) => g.productId === drop.id)
      const userTierSlug = customer.loyaltyTier?.slug
      const userHasEarlyAccessBenefit = customer.loyaltyTier?.earlyDropAccess || false
      
      // Check if user already has access via tier
      const hasTierAccess = drop.earlyAccessConfigs.some((config: EarlyAccessConfig) => {
        if (config.loyaltyTierId && config.loyaltyTier?.slug === userTierSlug) {
          return true
        }
        if (!config.loyaltyTierId && userHasEarlyAccessBenefit) {
          return true
        }
        return false
      })
      
      // Get the best unlockable config (lowest points cost)
      const unlockableConfig = drop.earlyAccessConfigs
        .filter((c: EarlyAccessConfig) => c.pointsCost > 0)
        .sort((a: EarlyAccessConfig, b: EarlyAccessConfig) => a.pointsCost - b.pointsCost)[0]
      
      const totalInventory = drop.variants.reduce((sum: number, v: Pick<ProductVariant, 'id' | 'inventory'>) => sum + v.inventory, 0)
      
      // Parse images
      let images: string[] = []
      try {
        const parsed = JSON.parse(drop.images)
        images = Array.isArray(parsed) 
          ? parsed.map((img: string | { url: string }) => typeof img === 'string' ? img : img.url)
          : []
      } catch {
        images = [drop.images].filter(Boolean)
      }
      
      return {
        id: drop.id,
        name: drop.name,
        slug: drop.slug,
        price: drop.price,
        image: images[0] || '/placeholder-product.jpg',
        releaseDate: drop.releaseDate,
        dropEndDate: drop.dropEndDate,
        totalInventory,
        hasAccess: !!existingGrant || hasTierAccess,
        accessReason: existingGrant 
          ? (existingGrant.grantType === EarlyAccessType.POINTS_REDEMPTION ? 'points_unlock' : 'tier_benefit')
          : hasTierAccess 
            ? 'tier_benefit' 
            : null,
        canUnlock: !existingGrant && !hasTierAccess && !!unlockableConfig,
        pointsCost: unlockableConfig?.pointsCost || null,
        earlyAccessEnds: unlockableConfig?.endDate || drop.earlyAccessConfigs[0]?.endDate,
        tierName: customer.loyaltyTier?.name
      }
    })
    
    return NextResponse.json({
      drops,
      currentPoints: customer.currentPoints,
      userTier: customer.loyaltyTier?.name || 'Newcomer'
    })
    
  } catch (error) {
    console.error('Error fetching available drops:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
