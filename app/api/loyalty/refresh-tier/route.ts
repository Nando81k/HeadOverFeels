import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/prisma'
import { updateCustomerTier } from '@/lib/loyalty/service'

/**
 * POST /api/loyalty/refresh-tier
 * Re-evaluates and updates the user's loyalty tier based on current annual points
 * Returns the updated tier info if changed
 */
export async function POST(request: NextRequest) {
  try {
    // First, try NextAuth session (for OAuth users)
    const session = await auth()
    let customerId: string | null = null

    if (session?.user?.id) {
      customerId = session.user.id
    } else {
      // Fall back to cookie-based session (for existing email/password users)
      const sessionId = request.cookies.get('auth_session')?.value
      if (sessionId) {
        customerId = sessionId
      }
    }
    
    if (!customerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { loyaltyTier: true },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const previousTier = customer.loyaltyTier
    
    // Re-evaluate and update tier
    const newTier = await updateCustomerTier(customer.id)
    
    if (newTier) {
      // Tier was upgraded
      console.log(`🎉 Tier refresh: ${customer.email} upgraded from ${previousTier?.slug} to ${newTier.slug}`)
      
      // Fetch updated customer data
      const updatedCustomer = await prisma.customer.findUnique({
        where: { id: customer.id },
        include: { loyaltyTier: true },
      })
      
      return NextResponse.json({
        success: true,
        upgraded: true,
        previousTier: previousTier?.slug,
        newTier: newTier.slug,
        customer: {
          currentPoints: updatedCustomer?.currentPoints,
          annualPointsEarned: updatedCustomer?.annualPointsEarned,
          loyaltyTier: updatedCustomer?.loyaltyTier,
        },
      })
    }

    // No tier change needed
    return NextResponse.json({
      success: true,
      upgraded: false,
      currentTier: previousTier?.slug,
    })
    
  } catch (error) {
    console.error('Error refreshing tier:', error)
    return NextResponse.json(
      { error: 'Failed to refresh tier' },
      { status: 500 }
    )
  }
}
