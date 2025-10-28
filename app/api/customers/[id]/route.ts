/**
 * Customer Detail API Route
 * 
 * GET /api/customers/[id] - Get customer details with orders and notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateCustomerSegment } from '@/lib/customer-segments';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Fetch customer with orders and notes
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: {
            createdAt: 'desc'
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true
          }
        },
        notes: {
          orderBy: {
            createdAt: 'desc'
          },
          select: {
            id: true,
            content: true,
            authorName: true,
            isImportant: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });
    
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }
    
    // Calculate segment
    const segment = calculateCustomerSegment(customer);
    
    return NextResponse.json({
      success: true,
      data: {
        ...customer,
        segment
      }
    });
    
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}
