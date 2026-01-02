import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma, AvatarSlot } from '@prisma/client';
import { verifyAdmin } from '@/lib/auth/admin';

// GET /api/avatar/items - Get all available avatar items (for browsing)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slot = searchParams.get('slot');
    const customerId = request.headers.get('x-customer-id');

    const where: Prisma.AvatarItemWhereInput = {};
    if (slot) {
      where.slot = slot as AvatarSlot;
    }

    const items = await prisma.avatarItem.findMany({
      where,
      orderBy: [{ rarity: 'desc' }, { name: 'asc' }],
    });

    // If customerId provided, mark which items are unlocked
    if (customerId) {
      const unlockedItems = await prisma.userAvatarItem.findMany({
        where: { customerId },
        select: { avatarItemId: true },
      });

      const unlockedIds = new Set(unlockedItems.map((item) => item.avatarItemId));

      return NextResponse.json({
        items: items.map((item) => ({
          ...item,
          unlocked: item.isDefault || unlockedIds.has(item.id),
        })),
      });
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching avatar items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch avatar items' },
      { status: 500 }
    );
  }
}

// POST /api/avatar/items - Create new avatar item (admin only)
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminId = await verifyAdmin(request)
    
    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      slot,
      modelUrl,
      thumbnailUrl,
      productId,
      rarity,
      isDefault,
    } = body;

    // Validation
    if (!name || !slot || !modelUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slot, modelUrl' },
        { status: 400 }
      );
    }

    const item = await prisma.avatarItem.create({
      data: {
        name,
        description,
        slot: slot as AvatarSlot,
        modelUrl,
        thumbnailUrl,
        productId,
        rarity: rarity || 'COMMON',
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error creating avatar item:', error);
    return NextResponse.json(
      { error: 'Failed to create avatar item' },
      { status: 500 }
    );
  }
}
