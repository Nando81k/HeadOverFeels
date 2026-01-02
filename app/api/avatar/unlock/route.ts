import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/avatar/unlock - Unlock avatar items for a completed order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, customerId } = body;

    if (!orderId || !customerId) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, customerId' },
        { status: 400 }
      );
    }

    // Get order with items
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                avatarItems: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify order belongs to customer
    if (order.customerId !== customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Collect all avatar items from ordered products
    const avatarItemsToUnlock: string[] = [];
    for (const orderItem of order.items) {
      if (orderItem.product.avatarItems && orderItem.product.avatarItems.length > 0) {
        avatarItemsToUnlock.push(
          ...orderItem.product.avatarItems.map((item: { id: string }) => item.id)
        );
      }
    }

    if (avatarItemsToUnlock.length === 0) {
      return NextResponse.json({
        message: 'No avatar items to unlock for this order',
        unlockedItems: [],
      });
    }

    // Unlock items for the user
    const unlockPromises = avatarItemsToUnlock.map((avatarItemId) =>
      prisma.userAvatarItem.upsert({
        where: {
          customerId_avatarItemId: {
            customerId,
            avatarItemId,
          },
        },
        update: {},
        create: {
          customerId,
          avatarItemId,
          unlockedVia: 'purchase',
          orderId,
        },
      })
    );

    await Promise.all(unlockPromises);

    // Fetch full details of unlocked items
    const items = await prisma.avatarItem.findMany({
      where: {
        id: { in: avatarItemsToUnlock },
      },
    });

    return NextResponse.json({
      message: `Unlocked ${items.length} avatar item(s)`,
      unlockedItems: items,
    });
  } catch (error) {
    console.error('Error unlocking avatar items:', error);
    return NextResponse.json(
      { error: 'Failed to unlock avatar items' },
      { status: 500 }
    );
  }
}
