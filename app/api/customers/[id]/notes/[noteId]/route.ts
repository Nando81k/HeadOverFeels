/**
 * Legacy compatibility route.
 *
 * Canonical admin notes routes are under /api/admin/customers/[id]/notes.
 * This endpoint is retained for backwards compatibility and now requires admin auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: customerId, noteId } = await params
    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''

    if (!content) {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      )
    }

    const existing = await prisma.customerNote.findFirst({
      where: { id: noteId, customerId },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const note = await prisma.customerNote.update({
      where: { id: noteId },
      data: {
        content,
        isImportant: Boolean(body?.isImportant),
      },
    })

    return NextResponse.json({
      success: true,
      data: note,
      legacy: true,
    })
  } catch (error) {
    console.error('Error updating customer note:', error)
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: customerId, noteId } = await params

    const existing = await prisma.customerNote.findFirst({
      where: { id: noteId, customerId },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    await prisma.customerNote.delete({
      where: { id: noteId },
    })

    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully',
      legacy: true,
    })
  } catch (error) {
    console.error('Error deleting customer note:', error)
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    )
  }
}
