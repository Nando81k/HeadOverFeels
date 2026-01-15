/**
 * Gift Card Admin Detail API
 * 
 * GET - Get gift card details
 * PATCH - Update gift card (adjust balance, disable, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  getGiftCardDetails, 
  adjustGiftCardBalance, 
  disableGiftCard,
  activateGiftCard 
} from '@/lib/gift-cards'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// Admin authorization helper
async function verifyAdmin(email: string | null | undefined) {
  if (!email) return null
  
  return prisma.adminUser.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  })
}

// ===== GET: Get gift card details =====
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const session = await auth()
  
  const admin = await verifyAdmin(session?.user?.email)
  if (!admin) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    )
  }
  
  const giftCard = await getGiftCardDetails(id)
  
  if (!giftCard) {
    return NextResponse.json(
      { error: 'Gift card not found' },
      { status: 404 }
    )
  }
  
  return NextResponse.json(giftCard)
}

// ===== PATCH: Update gift card =====
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const session = await auth()
  
  const admin = await verifyAdmin(session?.user?.email)
  if (!admin) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    )
  }
  
  try {
    const body = await request.json()
    const { action, amount, reason } = body
    
    switch (action) {
      case 'adjust': {
        if (typeof amount !== 'number') {
          return NextResponse.json(
            { error: 'Amount is required for adjustment' },
            { status: 400 }
          )
        }
        if (!reason) {
          return NextResponse.json(
            { error: 'Reason is required for adjustment' },
            { status: 400 }
          )
        }
        
        const result = await adjustGiftCardBalance(id, amount, reason)
        
        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          )
        }
        
        return NextResponse.json({
          success: true,
          newBalance: result.newBalance,
          message: `Balance adjusted by $${amount >= 0 ? '+' : ''}${amount.toFixed(2)}`,
        })
      }
      
      case 'disable': {
        if (!reason) {
          return NextResponse.json(
            { error: 'Reason is required for disabling' },
            { status: 400 }
          )
        }
        
        const result = await disableGiftCard(id, reason)
        
        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          )
        }
        
        return NextResponse.json({
          success: true,
          message: 'Gift card has been disabled',
        })
      }
      
      case 'activate': {
        const result = await activateGiftCard(id)
        
        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          )
        }
        
        return NextResponse.json({
          success: true,
          message: 'Gift card has been activated',
        })
      }
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: adjust, disable, or activate' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Gift card admin error:', error)
    return NextResponse.json(
      { error: 'Failed to update gift card' },
      { status: 500 }
    )
  }
}
