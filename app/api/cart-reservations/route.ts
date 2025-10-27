import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

const RESERVATION_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Validation schema
const reserveSchema = z.object({
  productId: z.string().cuid('Invalid product ID'),
  productVariantId: z.string().cuid('Invalid variant ID').optional(),
  quantity: z.number().int().positive(),
  sessionId: z.string().optional(), // Will generate if not provided
});

/**
 * POST /api/cart-reservations
 * Reserve inventory for a limited drop item
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = reserveSchema.parse(body);

    // Generate session ID if not provided
    const sessionId = validatedData.sessionId || uuidv4();

    // Check if product is a limited edition drop
    const product = await prisma.product.findUnique({
      where: { id: validatedData.productId },
      select: {
        id: true,
        name: true,
        isLimitedEdition: true,
        dropEndDate: true,
        variants: {
          where: validatedData.productVariantId
            ? { id: validatedData.productVariantId }
            : undefined,
          select: {
            id: true,
            inventory: true,
          },
        },
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
        {
          success: true,
          message: 'Regular product - no reservation needed',
          sessionId,
        },
        { status: 200 }
      );
    }

    // Check if drop has ended
    if (product.dropEndDate && new Date() > product.dropEndDate) {
      return NextResponse.json(
        { error: 'This drop has ended' },
        { status: 400 }
      );
    }

    const variant = validatedData.productVariantId
      ? product.variants.find((v) => v.id === validatedData.productVariantId)
      : product.variants[0];

    if (!variant) {
      return NextResponse.json(
        { error: 'Product variant not found' },
        { status: 404 }
      );
    }

    // Clean up expired reservations first
    await cleanupExpiredReservations();

    // Calculate available inventory (actual - active reservations)
    const activeReservations = await prisma.cartReservation.aggregate({
      where: {
        productVariantId: variant.id,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
      _sum: {
        quantity: true,
      },
    });

    const reservedQuantity = activeReservations._sum.quantity || 0;
    const availableInventory = variant.inventory - reservedQuantity;

    if (availableInventory < validatedData.quantity) {
      return NextResponse.json(
        {
          error: 'Not enough inventory available',
          available: availableInventory,
          requested: validatedData.quantity,
        },
        { status: 400 }
      );
    }

    // Create or update reservation
    const expiresAt = new Date(Date.now() + RESERVATION_DURATION_MS);

    // Check for existing reservation from this session
    const existingReservation = await prisma.cartReservation.findFirst({
      where: {
        sessionId,
        productVariantId: variant.id,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    let reservation;

    if (existingReservation) {
      // Update existing reservation
      reservation = await prisma.cartReservation.update({
        where: { id: existingReservation.id },
        data: {
          quantity: validatedData.quantity,
          expiresAt,
        },
      });
    } else {
      // Create new reservation
      reservation = await prisma.cartReservation.create({
        data: {
          sessionId,
          productId: validatedData.productId,
          productVariantId: variant.id,
          quantity: validatedData.quantity,
          expiresAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      reservation: {
        id: reservation.id,
        sessionId,
        quantity: reservation.quantity,
        expiresAt: reservation.expiresAt,
        timeRemaining: RESERVATION_DURATION_MS,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Cart reservation error:', error);
    return NextResponse.json(
      { error: 'Failed to reserve inventory' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cart-reservations?sessionId=xxx
 * Release reservation when user removes item or completes checkout
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const reservationId = searchParams.get('reservationId');

    if (!sessionId && !reservationId) {
      return NextResponse.json(
        { error: 'Session ID or Reservation ID is required' },
        { status: 400 }
      );
    }

    const where = reservationId
      ? { id: reservationId }
      : { sessionId: sessionId! };

    await prisma.cartReservation.updateMany({
      where: {
        ...where,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Reservation released',
    });
  } catch (error) {
    console.error('Error releasing reservation:', error);
    return NextResponse.json(
      { error: 'Failed to release reservation' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to clean up expired reservations
 */
async function cleanupExpiredReservations() {
  await prisma.cartReservation.updateMany({
    where: {
      isActive: true,
      expiresAt: {
        lte: new Date(),
      },
    },
    data: {
      isActive: false,
    },
  });
}
