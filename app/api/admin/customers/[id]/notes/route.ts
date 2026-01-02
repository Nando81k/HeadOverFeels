/**
 * Customer Notes API Route
 * 
 * POST /api/admin/customers/[id]/notes - Create a new note
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin auth using NextAuth session or cookie fallback
    const session = await auth();
    let userId: string | null = null;

    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      const sessionId = request.cookies.get('auth_session')?.value;
      if (sessionId) {
        userId = sessionId;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is an admin
    const adminUser = await prisma.customer.findUnique({
      where: { id: userId },
      select: { isAdmin: true, name: true, email: true },
    });

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
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
    const { content, isImportant = false } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Create the note
    const note = await prisma.customerNote.create({
      data: {
        customerId,
        content: content.trim(),
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
