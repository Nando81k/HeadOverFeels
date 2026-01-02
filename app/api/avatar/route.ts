import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/avatar - Get user's avatar configuration and unlocked items
export async function GET(request: NextRequest) {
  try {
    const customerId = request.headers.get('x-customer-id');

    if (!customerId) {
      return NextResponse.json(
        { error: 'Unauthorized - Customer ID required' },
        { status: 401 }
      );
    }

    // Get or create avatar
    let avatar = await prisma.userAvatar.findUnique({
      where: { customerId },
    });

    if (!avatar) {
      // Create default avatar
      avatar = await prisma.userAvatar.create({
        data: {
          customerId,
          configuration: JSON.stringify({}),
          skinTone: '#FFE0BD',
          bodyType: 'default',
        },
      });
    }

    // Get unlocked items
    const unlockedItems = await prisma.userAvatarItem.findMany({
      where: { customerId },
      include: {
        avatarItem: true,
      },
    });

    // Get all available default items
    const defaultItems = await prisma.avatarItem.findMany({
      where: { isDefault: true },
    });

    return NextResponse.json({
      avatar: {
        ...avatar,
        configuration: JSON.parse(avatar.configuration),
      },
      unlockedItems: unlockedItems.map((item) => item.avatarItem),
      defaultItems,
    });
  } catch (error) {
    console.error('Error fetching avatar:', error);
    return NextResponse.json(
      { error: 'Failed to fetch avatar data' },
      { status: 500 }
    );
  }
}

// PUT /api/avatar - Update avatar configuration
export async function PUT(request: NextRequest) {
  try {
    const customerId = request.headers.get('x-customer-id');

    if (!customerId) {
      return NextResponse.json(
        { error: 'Unauthorized - Customer ID required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { configuration, skinTone, bodyType, gender, faceFeatures } = body;

    // Validate configuration
    if (configuration) {
      // Ensure user owns all equipped items
      const equippedItemIds = Object.values(configuration).filter(Boolean) as string[];

      if (equippedItemIds.length > 0) {
        const ownedItems = await prisma.userAvatarItem.findMany({
          where: {
            customerId,
            avatarItemId: { in: equippedItemIds },
          },
        });

        const ownedItemIds = ownedItems.map((item) => item.avatarItemId);
        const unauthorized = equippedItemIds.filter(
          (id) => !ownedItemIds.includes(id)
        );

        // Check if unauthorized items are default items
        if (unauthorized.length > 0) {
          const defaultItems = await prisma.avatarItem.findMany({
            where: {
              id: { in: unauthorized },
              isDefault: true,
            },
          });

          const defaultItemIds = defaultItems.map((item) => item.id);
          const stillUnauthorized = unauthorized.filter(
            (id) => !defaultItemIds.includes(id)
          );

          if (stillUnauthorized.length > 0) {
            return NextResponse.json(
              { error: 'You do not own some of the equipped items' },
              { status: 403 }
            );
          }
        }
      }
    }

    // Update avatar
    const avatar = await prisma.userAvatar.upsert({
      where: { customerId },
      update: {
        ...(configuration && { configuration: JSON.stringify(configuration) }),
        ...(skinTone && { skinTone }),
        ...(bodyType && { bodyType }),
        ...(gender && { gender }),
        ...(faceFeatures && { faceFeatures }),
      },
      create: {
        customerId,
        configuration: JSON.stringify(configuration || {}),
        skinTone: skinTone || '#FFE0BD',
        bodyType: bodyType || 'default',
        gender: gender || 'male',
        faceFeatures: faceFeatures || JSON.stringify({ eyeShape: 'round', noseShape: 'medium', mouthShape: 'smile', eyebrowShape: 'normal' }),
      },
    });

    return NextResponse.json({
      avatar: {
        ...avatar,
        configuration: JSON.parse(avatar.configuration),
      },
    });
  } catch (error) {
    console.error('Error updating avatar:', error);
    return NextResponse.json(
      { error: 'Failed to update avatar' },
      { status: 500 }
    );
  }
}
