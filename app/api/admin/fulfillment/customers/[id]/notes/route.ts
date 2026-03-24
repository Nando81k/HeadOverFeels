import { NextRequest, NextResponse } from 'next/server'
import { AuditAction } from '@prisma/client'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getFulfillmentAuditLogger } from '@/lib/fulfillment/audit'

const CreateNoteSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  isImportant: z.boolean().optional().default(false),
})

const UpdateNoteSchema = z.object({
  noteId: z.string().trim().min(1),
  content: z.string().trim().min(1).max(4000).optional(),
  isImportant: z.boolean().optional(),
})

async function requireAdminForCustomer(request: NextRequest, customerId: string) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, email: true },
  })

  if (!customer) {
    return { error: NextResponse.json({ error: 'Customer not found' }, { status: 404 }) }
  }

  return { adminId, customer }
}

// GET /api/admin/fulfillment/customers/[id]/notes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const validation = await requireAdminForCustomer(request, id)
    if (validation.error) {
      return validation.error
    }

    const notes = await prisma.customerNote.findMany({
      where: {
        customerId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })

    return NextResponse.json({
      success: true,
      notes: notes.map((note) => ({
        ...note,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Failed to list customer notes from fulfillment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer notes' },
      { status: 500 }
    )
  }
}

// POST /api/admin/fulfillment/customers/[id]/notes
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const validation = await requireAdminForCustomer(request, id)
    if (validation.error) {
      return validation.error
    }

    const payload = CreateNoteSchema.parse(await request.json())
    const admin = await prisma.customer.findUnique({
      where: { id: validation.adminId },
      select: { name: true, email: true },
    })

    const note = await prisma.customerNote.create({
      data: {
        customerId: id,
        content: payload.content,
        isImportant: payload.isImportant,
        authorId: validation.adminId,
        authorName: admin?.name || admin?.email || 'Admin',
      },
    })

    const audit = await getFulfillmentAuditLogger(validation.adminId, request)
    await audit.logCustomer(AuditAction.CREATE, id, 'Created customer note from fulfillment center', {
      customerEmail: validation.customer.email,
      metadata: {
        noteId: note.id,
        isImportant: note.isImportant,
      },
    })

    return NextResponse.json({
      success: true,
      note: {
        ...note,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to create customer note from fulfillment:', error)
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/fulfillment/customers/[id]/notes?noteId=<id>
// Also supports body payload { noteId } to simplify client usage.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const validation = await requireAdminForCustomer(request, id)
    if (validation.error) {
      return validation.error
    }

    const url = new URL(request.url)
    const queryNoteId = url.searchParams.get('noteId')
    let bodyNoteId: string | null = null
    try {
      const body = await request.json()
      if (typeof body?.noteId === 'string') {
        bodyNoteId = body.noteId
      }
    } catch {
      bodyNoteId = null
    }

    const parsed = UpdateNoteSchema.safeParse({ noteId: queryNoteId || bodyNoteId || '' })
    if (!parsed.success) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 })
    }

    const note = await prisma.customerNote.findFirst({
      where: {
        id: parsed.data.noteId,
        customerId: id,
      },
      select: {
        id: true,
      },
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    await prisma.customerNote.delete({
      where: { id: note.id },
    })

    const audit = await getFulfillmentAuditLogger(validation.adminId, request)
    await audit.logCustomer(AuditAction.DELETE, id, 'Deleted customer note from fulfillment center', {
      customerEmail: validation.customer.email,
      metadata: {
        noteId: note.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete customer note from fulfillment:', error)
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    )
  }
}
