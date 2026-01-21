import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'
import { EarlyAccessGrant, EarlyAccessType, Prisma } from '@prisma/client'

// Redeem points to unlock early access to a specific drop
export async function POST(request: NextRequest) {
  try {
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
    
    if (!customerId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const body = await request.json()
    const { productId, configId } = body
    
    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    }
    
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        earlyAccessGrants: {
          where: { productId }
        }
      }
    })
    
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    
    // Check if already has access
    const now = new Date()
    const existingGrant = customer.earlyAccessGrants.find((g: EarlyAccessGrant) => 
      g.productId === productId && g.validUntil > now
    )
    
    if (existingGrant) {
      return NextResponse.json({ 
        error: 'Already have early access to this drop',
        grantId: existingGrant.id 
      }, { status: 400 })
    }
    
    // Get the early access config
    const config = await prisma.dropEarlyAccess.findFirst({
      where: {
        productId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gt: now },
        ...(configId ? { id: configId } : {})
      },
      include: {
        product: true
      }
    })
    
    if (!config) {
      return NextResponse.json({ 
        error: 'No active early access period for this drop' 
      }, { status: 400 })
    }
    
    if (config.pointsCost <= 0) {
      return NextResponse.json({ 
        error: 'This early access cannot be unlocked with points' 
      }, { status: 400 })
    }
    
    // Check if customer has enough points
    if (customer.currentPoints < config.pointsCost) {
      return NextResponse.json({ 
        error: 'Insufficient points',
        required: config.pointsCost,
        current: customer.currentPoints
      }, { status: 400 })
    }
    
    // Find the early access reward to create proper redemption
    const earlyAccessReward = await prisma.reward.findFirst({
      where: {
        rewardType: 'EARLY_ACCESS',
        isActive: true
      }
    })
    
    if (!earlyAccessReward) {
      return NextResponse.json({ 
        error: 'Early access reward not configured' 
      }, { status: 500 })
    }
    
    // Create the redemption and grant in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create reward redemption
      const redemption = await tx.rewardRedemption.create({
        data: {
          customerId: customer.id,
          rewardId: earlyAccessReward.id,
          pointsSpent: config.pointsCost,
          status: 'FULFILLED',
          usedAt: now,
          idempotencyKey: uuidv4(),
          metadata: JSON.stringify({
            productId: config.productId,
            productName: config.product.name,
            earlyAccessConfigId: config.id
          })
        }
      })
      
      // Deduct points
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          currentPoints: { decrement: config.pointsCost }
        }
      })
      
      // Create points transaction record
      await tx.pointsTransaction.create({
        data: {
          customerId: customer.id,
          points: -config.pointsCost,
          type: 'REDEMPTION',
          description: `Unlocked early access to ${config.product.name}`,
          redemptionId: redemption.id
        }
      })
      
      // Create early access grant
      const grant = await tx.earlyAccessGrant.create({
        data: {
          customerId: customer.id,
          productId: config.productId,
          grantType: EarlyAccessType.POINTS_REDEMPTION,
          redemptionId: redemption.id,
          validUntil: config.endDate
        }
      })
      
      return { redemption, grant }
    })
    
    return NextResponse.json({
      success: true,
      grantId: result.grant.id,
      validUntil: result.grant.validUntil,
      pointsSpent: config.pointsCost,
      remainingPoints: customer.currentPoints - config.pointsCost,
      productName: config.product.name
    })
    
  } catch (error) {
    console.error('Error unlocking early access:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
