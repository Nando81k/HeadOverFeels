import { NextRequest, NextResponse } from 'next/server'
import { AuditAction } from '@prisma/client'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getFulfillmentAuditLogger } from '@/lib/fulfillment/audit'

const UpdateCustomerSchema = z.object({
  name: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  birthday: z.string().nullable().optional(),
  newsletter: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
})

function parseBirthday(value: string | null | undefined) {
  if (value === undefined) {
    return undefined
  }
  if (value === null || value.trim().length === 0) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'invalid'
  }
  return parsed
}

// PATCH /api/admin/fulfillment/customers/[id]
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
    const payload = UpdateCustomerSchema.parse(await request.json())

    const existing = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        birthday: true,
        newsletter: true,
        smsOptIn: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const parsedBirthday = parseBirthday(payload.birthday)
    if (parsedBirthday === 'invalid') {
      return NextResponse.json({ error: 'Invalid birthday value' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}

    if ('name' in payload) {
      updates.name = payload.name === null ? null : payload.name || null
    }
    if ('phone' in payload) {
      updates.phone = payload.phone === null ? null : payload.phone || null
    }
    if (parsedBirthday !== undefined) {
      updates.birthday = parsedBirthday
    }
    if (typeof payload.newsletter === 'boolean') {
      updates.newsletter = payload.newsletter
    }
    if (typeof payload.smsOptIn === 'boolean') {
      updates.smsOptIn = payload.smsOptIn
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        birthday: true,
        newsletter: true,
        smsOptIn: true,
        updatedAt: true,
      },
    })

    const audit = await getFulfillmentAuditLogger(adminId, request)
    await audit.logCustomer(
      AuditAction.UPDATE,
      updated.id,
      'Updated customer profile from fulfillment center',
      {
        customerEmail: updated.email,
        changes: {
          before: {
            name: existing.name,
            phone: existing.phone,
            birthday: existing.birthday?.toISOString() || null,
            newsletter: existing.newsletter,
            smsOptIn: existing.smsOptIn,
          },
          after: {
            name: updated.name,
            phone: updated.phone,
            birthday: updated.birthday?.toISOString() || null,
            newsletter: updated.newsletter,
            smsOptIn: updated.smsOptIn,
          },
        },
      }
    )

    return NextResponse.json({
      success: true,
      customer: {
        ...updated,
        birthday: updated.birthday?.toISOString() || null,
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to update customer from fulfillment:', error)
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}
