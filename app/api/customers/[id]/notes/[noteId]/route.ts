/**
 * Individual Customer Note API Route
 * 
 * PUT /api/customers/[id]/notes/[noteId] - Update a note
 * DELETE /api/customers/[id]/notes/[noteId] - Delete a note
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: customerId, noteId } = await params;
    const body = await request.json();
    const { content, isImportant } = body;
    
    if (!content || content.trim() === '') {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      );
    }
    
    // Update note
    const note = await prisma.customerNote.update({
      where: { id: noteId },
      data: {
        content: content.trim(),
        isImportant
      }
    });
    
    return NextResponse.json({
      success: true,
      data: note
    });
    
  } catch (error) {
    console.error('Error updating customer note:', error);
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: customerId, noteId } = await params;
    
    // Delete note
    await prisma.customerNote.delete({
      where: { id: noteId }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting customer note:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}
