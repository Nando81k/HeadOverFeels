import { NextRequest, NextResponse } from 'next/server'
import { AuditAction } from '@prisma/client'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getFulfillmentAuditLogger } from '@/lib/fulfillment/audit'

const LoyaltyActionSchema = z.object({
  action: z.enum(['adjustPoints', 'changeTier']),
  points: z.number().int().optional(),
  reason: z.string().trim().max(240).optional(),
  tierId: z.string().trim().optional(),
})

// POST /api/admin/fulfillment/customers/[id]/loyalty
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const payload = LoyaltyActionSchema.parse(await request.json())

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        currentPoints: true,
        loyaltyTierId: true,
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (payload.action === 'adjustPoints') {
      if (typeof payload.points !== 'number' || !Number.isInteger(payload.points)) {
        return NextResponse.json({ error: 'points is required for adjustPoints' }, { status: 400 })
      }
      const points = payload.points

      const description =
        payload.reason && payload.reason.length > 0
          ? payload.reason
          : `Manual adjustment by fulfillment admin (${points >= 0 ? '+' : ''}${points})`

      const updatedCustomer = await prisma.$transaction(async (tx) => {
        await tx.pointsTransaction.create({
          data: {
            customerId: id,
            points,
            type: 'ADMIN_ADJUSTMENT',
            description,
          },
        })

        const updateData: Record<string, unknown> = {
          currentPoints: { increment: points },
        }

        if (points > 0) {
          updateData.lifetimePoints = { increment: points }
          updateData.annualPointsEarned = { increment: points }
        }

        return tx.customer.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            currentPoints: true,
          },
        })
      })

      const audit = await getFulfillmentAuditLogger(adminId, request)
      await audit.logCustomer(AuditAction.UPDATE, id, 'Adjusted customer points from fulfillment center', {
        customerEmail: customer.email,
        metadata: {
          action: payload.action,
          points,
          reason: payload.reason || null,
          previousPoints: customer.currentPoints,
          currentPoints: updatedCustomer.currentPoints,
        },
      })

      return NextResponse.json({
        success: true,
        message: `${points >= 0 ? 'Added' : 'Removed'} ${Math.abs(points)} points`,
        currentPoints: updatedCustomer.currentPoints,
      })
    }

    if (!payload.tierId) {
      return NextResponse.json({ error: 'tierId is required for changeTier' }, { status: 400 })
    }

    const tier = await prisma.loyaltyTier.findUnique({
      where: { id: payload.tierId },
      select: {
        id: true,
        name: true,
      },
    })

    if (!tier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 })
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        loyaltyTierId: tier.id,
      },
      select: {
        id: true,
        loyaltyTier: {
          select: {
            id: true,
            name: true,
            pointMultiplier: true,
          },
        },
      },
    })

    const audit = await getFulfillmentAuditLogger(adminId, request)
    await audit.logCustomer(AuditAction.STATUS_CHANGE, id, 'Changed customer loyalty tier from fulfillment center', {
      customerEmail: customer.email,
      metadata: {
        action: payload.action,
        previousTierId: customer.loyaltyTierId,
        tierId: tier.id,
        tierName: tier.name,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Tier changed to ${tier.name}`,
      loyaltyTier: updated.loyaltyTier,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to update fulfillment loyalty action:', error)
    return NextResponse.json(
      { error: 'Failed to process loyalty action' },
      { status: 500 }
    )
  }
}
