/**
 * Customer List API Route
 * 
 * GET /api/customers - List customers with filters, search, and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateCustomerSegment, type CustomerSegment } from '@/lib/customer-segments';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const search = searchParams.get('search') || '';
    const segment = searchParams.get('segment') as CustomerSegment | null;
    const minSpent = searchParams.get('minSpent') ? parseFloat(searchParams.get('minSpent')!) : undefined;
    const minOrders = searchParams.get('minOrders') ? parseInt(searchParams.get('minOrders')!) : undefined;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // Build where clause
    const where: any = {};
    
    // Search filter (name or email)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Min spent filter
    if (minSpent !== undefined) {
      where.totalSpent = { gte: minSpent };
    }
    
    // Min orders filter
    if (minOrders !== undefined) {
      where.totalOrders = { gte: minOrders };
    }
    
    // Build order by
    const orderBy: any = {};
    if (sortBy === 'name') {
      orderBy.name = sortOrder;
    } else if (sortBy === 'email') {
      orderBy.email = sortOrder;
    } else if (sortBy === 'totalSpent') {
      orderBy.totalSpent = sortOrder;
    } else if (sortBy === 'totalOrders') {
      orderBy.totalOrders = sortOrder;
    } else if (sortBy === 'lastOrderDate') {
      orderBy.lastOrderDate = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }
    
    // Fetch customers with pagination
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          totalSpent: true,
          totalOrders: true,
          lastOrderDate: true,
          avgOrderValue: true,
          createdAt: true,
        }
      }),
      prisma.customer.count({ where })
    ]);
    
    // Calculate segments for each customer
    let customersWithSegments = customers.map(customer => ({
      ...customer,
      segment: calculateCustomerSegment(customer)
    }));
    
    // Filter by segment if specified
    if (segment) {
      customersWithSegments = customersWithSegments.filter(c => c.segment === segment);
    }
    
    // Recalculate total if segment filter applied
    const finalTotal = segment ? customersWithSegments.length : total;
    
    return NextResponse.json({
      customers: customersWithSegments,
      pagination: {
        page,
        limit,
        total: finalTotal,
        totalPages: Math.ceil(finalTotal / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}
