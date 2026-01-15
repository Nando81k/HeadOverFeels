/**
 * Gift Card Redemption API
 * 
 * POST - Apply a gift card to checkout
 */

import { NextRequest, NextResponse } from 'next/server'
import { redeemGiftCard, getGiftCardBalance } from '@/lib/gift-cards'
import { auth } from '@/lib/auth/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, amount, orderId } = body
    
    // Validate inputs
    if (!code) {
      return NextResponse.json(
        { error: 'Gift card code is required' },
        { status: 400 }
      )
    }
    
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }
    
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }
    
    // Get current user if authenticated
    let customerId: string | undefined
    const session = await auth()
    
    if (session?.user?.email) {
      const { prisma } = await import('@/lib/prisma')
      const customer = await prisma.customer.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
      customerId = customer?.id
    }
    
    // Redeem the gift card
    const result = await redeemGiftCard({
      code,
      amount,
      orderId,
      customerId,
    })
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      amountRedeemed: result.amountRedeemed,
      remainingBalance: result.remainingBalance,
      message: `Successfully applied $${result.amountRedeemed?.toFixed(2)} to your order`,
    })
    
  } catch (error) {
    console.error('Gift card redemption error:', error)
    return NextResponse.json(
      { error: 'Failed to redeem gift card' },
      { status: 500 }
    )
  }
}

// GET - Validate a gift card code before applying
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (!code) {
    return NextResponse.json(
      { error: 'Gift card code is required' },
      { status: 400 }
    )
  }
  
  const result = await getGiftCardBalance(code)
  
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 404 }
    )
  }
  
  // Check if card can be used
  if (result.status !== 'ACTIVE') {
    return NextResponse.json({
      valid: false,
      error: result.status === 'EXPIRED' 
        ? 'This gift card has expired' 
        : result.status === 'DEPLETED'
          ? 'This gift card has no remaining balance'
          : 'This gift card cannot be used',
    })
  }
  
  return NextResponse.json({
    valid: true,
    balance: result.balance,
    expiresAt: result.expiresAt,
  })
}
