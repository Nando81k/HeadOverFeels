/**
 * Customer Detail API Route
 * 
 * GET /api/admin/customers/[id] - Get comprehensive customer data
 * Including: profile, orders, points transactions, spending trends
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/auth';

export async function GET(
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
      // Fall back to cookie-based session
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

    const { id } = await params;

    // Fetch customer with all related data
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        loyaltyTier: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              select: {
                quantity: true,
                productName: true,
                price: true,
              }
            }
          }
        },
        pointsTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 100, // Last 100 transactions
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get next tier for progression
    let nextTier = null;
    if (customer.loyaltyTier) {
      nextTier = await prisma.loyaltyTier.findFirst({
        where: {
          minAnnualPoints: { gt: customer.loyaltyTier.minAnnualPoints },
          isActive: true,
          isInviteOnly: false,
        },
        orderBy: { minAnnualPoints: 'asc' },
      });
    } else {
      // Find the first tier
      nextTier = await prisma.loyaltyTier.findFirst({
        where: { isActive: true, isInviteOnly: false },
        orderBy: { minAnnualPoints: 'asc' },
      });
    }

    // Calculate expiring points (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringPointsData = await prisma.pointsTransaction.aggregate({
      where: {
        customerId: id,
        points: { gt: 0 },
        isExpired: false,
        expiresAt: {
          not: null,
          lte: thirtyDaysFromNow,
        },
      },
      _sum: { points: true },
    });

    const nextExpiringTransaction = await prisma.pointsTransaction.findFirst({
      where: {
        customerId: id,
        points: { gt: 0 },
        isExpired: false,
        expiresAt: { not: null },
      },
      orderBy: { expiresAt: 'asc' },
    });

    // Generate spending trends (last 12 months)
    const spendingTrends = generateSpendingTrends(customer.orders);

    // Generate points activity (last 6 months)
    const pointsActivity = generatePointsActivity(customer.pointsTransactions);

    // Calculate order-level points earned
    const ordersWithPoints = customer.orders.map(order => {
      const orderPoints = customer.pointsTransactions
        .filter(tx => tx.orderId === order.id && tx.points > 0)
        .reduce((sum, tx) => sum + tx.points, 0);
      
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        subtotal: order.subtotal,
        pointsEarned: orderPoints,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map(item => ({
          quantity: item.quantity,
          productName: item.productName,
          price: item.price,
        })),
      };
    });

    return NextResponse.json({
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        birthday: customer.birthday?.toISOString() || null,
        newsletter: customer.newsletter,
        smsOptIn: customer.smsOptIn,
        isAdmin: customer.isAdmin,
        createdAt: customer.createdAt.toISOString(),
        
        // CRM stats
        totalSpent: customer.totalSpent,
        totalOrders: customer.totalOrders,
        avgOrderValue: customer.avgOrderValue,
        lastOrderDate: customer.lastOrderDate?.toISOString() || null,
        
        // Loyalty data
        currentPoints: customer.currentPoints,
        lifetimePoints: customer.lifetimePoints,
        annualPointsEarned: customer.annualPointsEarned,
        currentTier: customer.loyaltyTier ? {
          id: customer.loyaltyTier.id,
          name: customer.loyaltyTier.name,
          minAnnualPoints: customer.loyaltyTier.minAnnualPoints,
          pointMultiplier: customer.loyaltyTier.pointMultiplier,
          perks: customer.loyaltyTier.perks,
        } : null,
        nextTier: nextTier ? {
          id: nextTier.id,
          name: nextTier.name,
          minAnnualPoints: nextTier.minAnnualPoints,
          pointMultiplier: nextTier.pointMultiplier,
          perks: nextTier.perks,
        } : null,
        
        // Expiring points
        expiringPoints: expiringPointsData._sum.points || 0,
        expiringDate: nextExpiringTransaction?.expiresAt?.toISOString() || null,
      },
      
      orders: ordersWithPoints,
      
      pointsTransactions: customer.pointsTransactions.map(tx => ({
        id: tx.id,
        points: tx.points,
        type: tx.type,
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
        expiresAt: tx.expiresAt?.toISOString() || null,
        isExpired: tx.isExpired,
      })),
      
      notes: customer.notes.map(note => ({
        id: note.id,
        content: note.content,
        authorName: note.authorName,
        isImportant: note.isImportant,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      })),
      
      // Charts data
      spendingTrends,
      pointsActivity,
    });
  } catch (error) {
    console.error('Failed to fetch customer details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer details' },
      { status: 500 }
    );
  }
}

// Generate monthly spending trends
function generateSpendingTrends(orders: Array<{ total: number; createdAt: Date }>) {
  const months: Record<string, { spending: number; orders: number }> = {};
  
  // Initialize last 12 months
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    months[key] = { spending: 0, orders: 0 };
  }

  // Aggregate order data
  orders.forEach(order => {
    const date = new Date(order.createdAt);
    const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    
    if (months[key]) {
      months[key].spending += order.total;
      months[key].orders += 1;
    }
  });

  return Object.entries(months).map(([month, data]) => ({
    month,
    spending: Math.round(data.spending * 100) / 100,
    orders: data.orders,
  }));
}

// Generate monthly points activity
function generatePointsActivity(transactions: Array<{ points: number; type: string; createdAt: Date }>) {
  const months: Record<string, { earned: number; redeemed: number }> = {};
  
  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const key = date.toLocaleDateString('en-US', { month: 'short' });
    months[key] = { earned: 0, redeemed: 0 };
  }

  // Aggregate transaction data
  transactions.forEach(tx => {
    const date = new Date(tx.createdAt);
    const key = date.toLocaleDateString('en-US', { month: 'short' });
    
    if (months[key]) {
      if (tx.points > 0 && tx.type !== 'EXPIRATION') {
        months[key].earned += tx.points;
      } else if (tx.points < 0) {
        months[key].redeemed += Math.abs(tx.points);
      }
    }
  });

  return Object.entries(months).map(([month, data]) => ({
    month,
    earned: data.earned,
    redeemed: data.redeemed,
  }));
}
