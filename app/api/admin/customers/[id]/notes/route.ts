/**
 * Customer Notes API Route
 * 
 * POST /api/admin/customers/[id]/notes - Create a new note
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: customerId } = await params;

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const body = await request.json();
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const isImportant = Boolean(body?.isImportant);

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const adminUser = await prisma.customer.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    // Create the note
    const note = await prisma.customerNote.create({
      data: {
        customerId,
        content,
        isImportant,
        authorId: userId,
        authorName: adminUser?.name || adminUser?.email || 'Admin',
      },
    });

    return NextResponse.json({
      note: {
        id: note.id,
        content: note.content,
        authorName: note.authorName,
        isImportant: note.isImportant,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to create note:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}
