import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminId = await verifyAdmin(request);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const filter = searchParams.get('filter') || 'notSent';

    // Build where clause based on filter
    let where = {};
    const now = new Date();
    
    switch (filter) {
      case 'notSent':
        where = {
          recoveryEmailSent: false,
          recovered: false,
          expiresAt: { gt: now }, // Not expired
        };
        break;
      case 'sent':
        where = {
          recoveryEmailSent: true,
          recovered: false,
        };
        break;
      case 'recovered':
        where = {
          recovered: true,
        };
        break;
      case 'all':
      default:
        where = {
          expiresAt: { gt: now }, // Only show non-expired carts
        };
        break;
    }

    // Query abandoned carts
    const carts = await prisma.abandonedCart.findMany({
      where,
      take: limit,
      orderBy: { abandonedAt: 'desc' },
      select: {
        id: true,
        customerEmail: true,
        customerName: true,
        items: true,
        totalValue: true,
        itemCount: true,
        abandonedAt: true,
        recoveryEmailSent: true,
        recoveryEmailSentAt: true,
        recovered: true,
        recoveredAt: true,
        discountCode: true,
        discountAmount: true,
      },
    });

    // Parse items JSON
    const transformedCarts = carts.map(cart => ({
      ...cart,
      items: JSON.parse(cart.items),
    }));

    return NextResponse.json({
      carts: transformedCarts,
      count: transformedCarts.length,
    });
  } catch (error) {
    console.error('Error fetching abandoned carts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch abandoned carts' },
      { status: 500 }
    );
  }
}
