/**
 * Individual Customer Note API Route
 * 
 * DELETE /api/admin/customers/[id]/notes/[noteId] - Delete a note
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
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
      select: { isAdmin: true },
    });

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { id: customerId, noteId } = await params;

    // Verify the note exists and belongs to this customer
    const note = await prisma.customerNote.findFirst({
      where: {
        id: noteId,
        customerId,
      },
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Delete the note
    await prisma.customerNote.delete({
      where: { id: noteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete note:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}
