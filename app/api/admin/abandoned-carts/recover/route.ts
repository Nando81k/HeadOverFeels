import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/prisma';

// Generate a unique discount code
function generateDiscountCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SAVE';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminId = await verifyAdmin(request);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { cartId } = body;

    if (!cartId) {
      return NextResponse.json({ error: 'Cart ID is required' }, { status: 400 });
    }

    // Get the abandoned cart
    const cart = await prisma.abandonedCart.findUnique({
      where: { id: cartId },
    });

    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    if (cart.recoveryEmailSent) {
      return NextResponse.json(
        { error: 'Recovery email already sent for this cart' },
        { status: 400 }
      );
    }

    if (cart.recovered) {
      return NextResponse.json(
        { error: 'This cart has already been recovered' },
        { status: 400 }
      );
    }

    // Generate discount code (10% off)
    const discountCode = generateDiscountCode();
    const discountAmount = cart.totalValue * 0.1; // 10% discount

    // Update the cart with recovery info
    await prisma.abandonedCart.update({
      where: { id: cartId },
      data: {
        recoveryEmailSent: true,
        recoveryEmailSentAt: new Date(),
        discountCode,
        discountAmount,
      },
    });

    // TODO: Send actual email here
    // For now, we'll just log the email content
    const emailContent = {
      to: cart.customerEmail,
      subject: 'Complete Your Order - Get 10% Off!',
      body: `
Hi ${cart.customerName || 'there'},

We noticed you left some items in your cart. We'd love to help you complete your order!

Your cart contains:
${JSON.parse(cart.items)
  .map((item: { productName: string; variantName?: string; quantity: number }) => 
    `- ${item.productName}${item.variantName ? ` (${item.variantName})` : ''} × ${item.quantity}`
  )
  .join('\n')}

Total: $${cart.totalValue.toFixed(2)}

🎁 Special offer: Use code ${discountCode} for 10% off your order!

Complete your purchase now: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/cart

This offer expires soon!

Best regards,
Head Over Feels Team
      `.trim(),
    };

    console.log('Recovery email (simulated):', emailContent);

    return NextResponse.json({
      success: true,
      message: 'Recovery email sent successfully',
      discountCode,
      discountAmount,
    });
  } catch (error) {
    console.error('Error sending recovery email:', error);
    return NextResponse.json(
      { error: 'Failed to send recovery email' },
      { status: 500 }
    );
  }
}
