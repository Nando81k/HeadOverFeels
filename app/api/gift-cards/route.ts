/**
 * Gift Cards API
 * 
 * GET - List gift cards (admin) or check balance (public with code)
 * POST - Purchase/create a gift card
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  createGiftCard, 
  getGiftCardBalance, 
  listGiftCards 
} from '@/lib/gift-cards'
import { auth } from '@/lib/auth/auth'

// ===== GET: Check balance or list gift cards =====
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  
  // If code is provided, return balance (public endpoint)
  if (code) {
    const result = await getGiftCardBalance(code)
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      balance: result.balance,
      status: result.status,
      expiresAt: result.expiresAt,
    })
  }
  
  // Otherwise, list gift cards (admin only)
  const session = await auth()
  
  // Check admin access
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }
  
  // Verify admin status (check if user is admin)
  const { prisma } = await import('@/lib/prisma')
  const adminUser = await prisma.adminUser.findUnique({
    where: { email: session.user.email },
  })
  
  if (!adminUser) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    )
  }
  
  const result = await listGiftCards({
    status: status as 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'DISABLED' | 'PENDING' | undefined,
    search: searchParams.get('search') || undefined,
    page,
    limit,
  })
  
  return NextResponse.json(result)
}

// ===== POST: Purchase/create a gift card =====
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      amount,
      recipientEmail,
      recipientName,
      senderName,
      personalMessage,
      expiresInDays,
    } = body
    
    // Validate amount
    if (!amount || amount < 10 || amount > 500) {
      return NextResponse.json(
        { error: 'Gift card amount must be between $10 and $500' },
        { status: 400 }
      )
    }
    
    // Get current user if authenticated
    let purchasedById: string | undefined
    const session = await auth()
    
    if (session?.user?.email) {
      const { prisma } = await import('@/lib/prisma')
      const customer = await prisma.customer.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
      purchasedById = customer?.id
    }
    
    // Calculate expiration date
    let expiresAt: Date | undefined
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiresInDays)
    } else {
      // Default expiration: 1 year
      expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    }
    
    // Create the gift card (status will be PENDING until payment)
    const result = await createGiftCard({
      initialBalance: amount,
      purchasedById,
      recipientEmail,
      recipientName,
      senderName,
      personalMessage,
      expiresAt,
    })
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      giftCard: result.giftCard,
      message: 'Gift card created successfully. Complete payment to activate.',
    }, { status: 201 })
    
  } catch (error) {
    console.error('Failed to create gift card:', error)
    return NextResponse.json(
      { error: 'Failed to create gift card' },
      { status: 500 }
    )
  }
}
