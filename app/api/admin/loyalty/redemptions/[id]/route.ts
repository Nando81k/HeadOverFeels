import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'
import { z } from 'zod'

const UpdateSchema = z.object({
  status: z.enum(['PENDING', 'FULFILLED', 'CANCELLED']).optional(),
  trackingNumber: z.string().max(255).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
})

// PATCH /api/admin/loyalty/redemptions/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validated = UpdateSchema.parse(body)

    const existing = await prisma.rewardRedemption.findUnique({
      where: { id },
      include: { reward: { select: { rewardType: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Redemption not found' }, { status: 404 })
    }

    const updateData: Parameters<typeof prisma.rewardRedemption.update>[0]['data'] = {}

    if (validated.status) {
      updateData.status = validated.status
      if (validated.status === 'FULFILLED' && !existing.shippedAt) {
        updateData.shippedAt = new Date()
      }
    }

    if (validated.trackingNumber !== undefined) {
      updateData.trackingNumber = validated.trackingNumber
    }

    if (validated.note !== undefined) {
      // Store admin note alongside any existing metadata
      let meta: Record<string, unknown> = {}
      try { meta = JSON.parse(existing.metadata || '{}') } catch { /* ignore */ }
      meta.adminNote = validated.note
      meta.adminNoteAt = new Date().toISOString()
      meta.adminId = adminId
      updateData.metadata = JSON.stringify(meta)
    }

    const updated = await prisma.rewardRedemption.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, email: true, name: true } },
        reward: { select: { id: true, name: true, rewardType: true } },
      },
    })

    return NextResponse.json({ success: true, redemption: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('PATCH /api/admin/loyalty/redemptions/[id] failed:', error)
    return NextResponse.json({ error: 'Failed to update redemption' }, { status: 500 })
  }
}
