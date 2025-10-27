import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Validation schema
const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  productId: z.string().cuid('Invalid product ID'),
  source: z.string().optional().default('homepage'),
});

/**
 * POST /api/drop-notifications
 * Subscribe to drop notifications for a specific product
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = subscribeSchema.parse(body);

    // Check if product exists and is a limited edition
    const product = await prisma.product.findUnique({
      where: { id: validatedData.productId },
      select: {
        id: true,
        name: true,
        isLimitedEdition: true,
        releaseDate: true,
        dropEndDate: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    if (!product.isLimitedEdition) {
      return NextResponse.json(
        { error: 'This product is not a limited edition drop' },
        { status: 400 }
      );
    }

    // Check if drop has already ended
    if (product.dropEndDate && new Date() > product.dropEndDate) {
      return NextResponse.json(
        { error: 'This drop has already ended' },
        { status: 400 }
      );
    }

    // Create or update notification subscription
    const notification = await prisma.dropNotification.upsert({
      where: {
        email_productId: {
          email: validatedData.email,
          productId: validatedData.productId,
        },
      },
      update: {
        source: validatedData.source,
      },
      create: {
        email: validatedData.email,
        productId: validatedData.productId,
        source: validatedData.source,
      },
    });

    // TODO: Send confirmation email
    // await sendDropNotificationConfirmation(validatedData.email, product);

    return NextResponse.json({
      success: true,
      message: "You'll be notified when this drop goes live!",
      notification: {
        id: notification.id,
        email: notification.email,
        productName: product.name,
        releaseDate: product.releaseDate,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Drop notification error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe to notifications' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/drop-notifications?productId=xxx
 * Get notification count for a specific product (admin use)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const count = await prisma.dropNotification.count({
      where: { productId },
    });

    const notifiedCount = await prisma.dropNotification.count({
      where: { productId, notified: true },
    });

    return NextResponse.json({
      productId,
      totalSubscribers: count,
      notifiedSubscribers: notifiedCount,
      pendingNotifications: count - notifiedCount,
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification statistics' },
      { status: 500 }
    );
  }
}
