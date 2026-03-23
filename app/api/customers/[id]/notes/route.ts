/**
 * Legacy compatibility route.
 *
 * Canonical admin notes routes are under /api/admin/customers/[id]/notes.
 * This endpoint is retained for backwards compatibility and now requires admin auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: customerId } = await params
    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    const isImportant = Boolean(body?.isImportant)

    if (!content) {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      )
    }

    const [admin, customer] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: adminId },
        select: { name: true, email: true },
      }),
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true },
      }),
    ])

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const note = await prisma.customerNote.create({
      data: {
        customerId,
        content,
        isImportant,
        authorId: adminId,
        authorName: admin?.name || admin?.email || 'Admin',
      },
    })

    return NextResponse.json({
      success: true,
      data: note,
      legacy: true,
    })
  } catch (error) {
    console.error('Error creating customer note:', error)
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: customerId } = await params

    const notes = await prisma.customerNote.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: notes,
      legacy: true,
    })
  } catch (error) {
    console.error('Error fetching customer notes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    )
  }
}
