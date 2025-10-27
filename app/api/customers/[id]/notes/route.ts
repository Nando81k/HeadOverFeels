/**
 * Customer Notes API Route
 * 
 * POST /api/customers/[id]/notes - Add a note to customer
 * GET /api/customers/[id]/notes - Get all notes for customer
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Helper to get current admin user (simplified - you may have auth middleware)
async function getCurrentAdmin() {
  // TODO: Implement proper admin auth check
  // For now, returning a default admin
  return {
    id: 'admin-1',
    name: 'Admin User'
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: customerId } = params;
    const body = await request.json();
    const { content, isImportant = false } = body;
    
    if (!content || content.trim() === '') {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      );
    }
    
    // Get current admin user
    const admin = await getCurrentAdmin();
    
    // Create note
    const note = await prisma.customerNote.create({
      data: {
        customerId,
        content: content.trim(),
        isImportant,
        authorId: admin.id,
        authorName: admin.name
      }
    });
    
    return NextResponse.json({
      success: true,
      data: note
    });
    
  } catch (error) {
    console.error('Error creating customer note:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: customerId } = params;
    
    const notes = await prisma.customerNote.findMany({
      where: { customerId },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json({
      success: true,
      data: notes
    });
    
  } catch (error) {
    console.error('Error fetching customer notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}
