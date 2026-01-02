import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronRequest } from '@/lib/security/cron'

/**
 * POST /api/cron/track-abandoned-carts
 * 
 * Cron job endpoint to track abandoned shopping carts
 * Should be scheduled to run periodically (e.g., every hour)
 * 
 * Security: HMAC-SHA256 signature verification required
 * Include headers:
 * - x-cron-signature: HMAC-SHA256(timestamp:method, CRON_SECRET)
 * - x-cron-timestamp: current timestamp in milliseconds
 */
export async function POST(request: NextRequest) {
  // Verify cron signature
  const verificationError = verifyCronRequest(request)
  if (verificationError) {
    return verificationError
  }

  try {

    // Find cart items that are older than 1 hour and haven't been converted to orders
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Get cart items grouped by customer
    const cartItems = await prisma.cartItem.findMany({
      where: {
        createdAt: { lt: oneHourAgo },
      },
      include: {
        customer: true,
        product: true,
        productVariant: true,
      },
      orderBy: {
        customerId: 'asc',
      },
    });

    // Group by customer
    const cartsByCustomer = new Map<string, typeof cartItems>();
    for (const item of cartItems) {
      const existing = cartsByCustomer.get(item.customerId) || [];
      existing.push(item);
      cartsByCustomer.set(item.customerId, existing);
    }

    let createdCount = 0;

    // Create abandoned cart records
    for (const [customerId, items] of cartsByCustomer) {
      const customer = items[0].customer;
      
      // Check if we already have an abandoned cart for this customer
      const existing = await prisma.abandonedCart.findFirst({
        where: {
          customerId,
          recovered: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (existing) {
        // Update existing abandoned cart
        const cartItemsData = items.map(item => ({
          productName: item.product.name,
          variantName: item.productVariant
            ? `${item.productVariant.size || ''}${item.productVariant.size && item.productVariant.color ? ' - ' : ''}${item.productVariant.color || ''}`
            : undefined,
          quantity: item.quantity,
          price: item.productVariant?.price || item.product.price,
        }));

        const totalValue = cartItemsData.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );

        await prisma.abandonedCart.update({
          where: { id: existing.id },
          data: {
            items: JSON.stringify(cartItemsData),
            totalValue,
            itemCount: items.length,
            abandonedAt: new Date(), // Update abandonment time
          },
        });
      } else {
        // Create new abandoned cart
        const cartItemsData = items.map(item => ({
          productName: item.product.name,
          variantName: item.productVariant
            ? `${item.productVariant.size || ''}${item.productVariant.size && item.productVariant.color ? ' - ' : ''}${item.productVariant.color || ''}`
            : undefined,
          quantity: item.quantity,
          price: item.productVariant?.price || item.product.price,
        }));

        const totalValue = cartItemsData.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );

        await prisma.abandonedCart.create({
          data: {
            customerId,
            customerEmail: customer.email,
            customerName: customer.name,
            items: JSON.stringify(cartItemsData),
            totalValue,
            itemCount: items.length,
            expiresAt: thirtyDaysFromNow,
          },
        });

        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${cartsByCustomer.size} carts, created ${createdCount} new abandoned cart records`,
      cartsProcessed: cartsByCustomer.size,
      created: createdCount,
    });
  } catch (error) {
    console.error('Abandoned carts cron job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track abandoned carts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
