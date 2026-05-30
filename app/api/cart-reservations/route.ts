import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { validateGuestSession, isValidGuestEmail } from '@/lib/security/guest-session';

const RESERVATION_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Validation schema
const reserveSchema = z.object({
  productId: z.string().cuid('Invalid product ID'),
  productVariantId: z.string().cuid('Invalid variant ID').optional(),
  quantity: z.number().int().positive('Quantity must be positive').max(100, 'Quantity too high'),
  sessionId: z.string().optional(), // Will generate if not provided
  guestEmail: z.string().email('Invalid email').max(255, 'Email too long').optional(), // For guest checkout validation
});

/**
 * POST /api/cart-reservations
 * Reserve inventory for a limited drop item
 * For guests: requires x-guest-email header to match guestEmail in body
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = reserveSchema.parse(body);

    // Generate session ID if not provided
    const sessionId = validatedData.sessionId || uuidv4();

    // Validate guest email if provided (security check)
    if (validatedData.guestEmail) {
      if (!isValidGuestEmail(validatedData.guestEmail)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }

      // Verify guest email matches the header (prevent guest email manipulation)
      const headerEmail = request.headers.get('x-guest-email')?.toLowerCase().trim();
      const bodyEmail = validatedData.guestEmail.toLowerCase().trim();

      if (!headerEmail || headerEmail !== bodyEmail) {
        return NextResponse.json(
          { error: 'Email validation failed' },
          { status: 400 }
        );
      }
    }

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

    // Wrap the inventory check + reservation create/update in a serializable
    // transaction so that two concurrent requests for the last unit cannot both
    // pass the availability check before either has written its reservation row.
    let reservation;
    try {
      reservation = await prisma.$transaction(async (tx) => {
        // Re-read variant inventory inside the transaction
        const variantInTx = await tx.productVariant.findUnique({
          where: { id: variant.id },
          select: { inventory: true },
        });

        if (!variantInTx) {
          throw new Error('Product variant not found');
        }

        // Calculate available inventory (actual - active reservations)
        const activeReservations = await tx.cartReservation.aggregate({
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
        const availableInventory = variantInTx.inventory - reservedQuantity;

        if (availableInventory < validatedData.quantity) {
          throw Object.assign(
            new Error('Not enough inventory available'),
            { available: availableInventory, requested: validatedData.quantity, isInventoryError: true }
          );
        }

        // Create or update reservation
        const expiresAt = new Date(Date.now() + RESERVATION_DURATION_MS);

        // Check for existing reservation from this session
        const existingReservation = await tx.cartReservation.findFirst({
          where: {
            sessionId,
            productVariantId: variant.id,
            isActive: true,
            expiresAt: {
              gt: new Date(),
            },
          },
        });

        if (existingReservation) {
          // Update existing reservation
          return tx.cartReservation.update({
            where: { id: existingReservation.id },
            data: {
              quantity: validatedData.quantity,
              expiresAt,
            },
          });
        } else {
          // Create new reservation
          return tx.cartReservation.create({
            data: {
              sessionId,
              productId: validatedData.productId,
              productVariantId: variant.id,
              quantity: validatedData.quantity,
              expiresAt,
            },
          });
        }
      }, { isolationLevel: 'Serializable' });
    } catch (txError) {
      if (txError instanceof Error && (txError as NodeJS.ErrnoException & { isInventoryError?: boolean }).isInventoryError) {
        const errWithMeta = txError as Error & { available: number; requested: number };
        return NextResponse.json(
          {
            error: 'Not enough inventory available',
            available: errWithMeta.available,
            requested: errWithMeta.requested,
          },
          { status: 400 }
        );
      }
      throw txError;
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
        { error: 'Validation error', details: error.issues },
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
 * For guests: requires x-guest-email header for validation
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const reservationId = searchParams.get('reservationId');
    const guestEmail = request.headers.get('x-guest-email');

    if (!sessionId && !reservationId) {
      return NextResponse.json(
        { error: 'Session ID or Reservation ID is required' },
        { status: 400 }
      );
    }

    // If guest email is provided, validate it
    if (guestEmail) {
      if (!isValidGuestEmail(guestEmail)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    const where = reservationId
      ? { id: reservationId }
      : { sessionId: sessionId! };

    // Only release active reservations
    const releaseCount = await prisma.cartReservation.updateMany({
      where: {
        ...where,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Return error if no reservations were released (prevents info leakage)
    if (releaseCount.count === 0) {
      return NextResponse.json(
        { error: 'No active reservations found' },
        { status: 404 }
      );
    }

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
