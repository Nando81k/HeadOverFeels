import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface ValidateRequest {
  code: string
  cartTotal: number
  productIds?: string[]
  customerEmail?: string
}

// POST /api/promotions/validate - Validate a promotion code
export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequest = await request.json()
    const { code, cartTotal, productIds, customerEmail } = body
    
    if (!code) {
      return NextResponse.json(
        { valid: false, error: 'Promotion code is required' },
        { status: 400 }
      )
    }
    
    const promotion = await prisma.promotion.findUnique({
      where: { code: code.toUpperCase() }
    })
    
    if (!promotion) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid promotion code'
      })
    }
    
    // Check if active
    if (!promotion.isActive) {
      return NextResponse.json({
        valid: false,
        error: 'This promotion is no longer active'
      })
    }
    
    // Check date range
    const now = new Date()
    if (promotion.startDate > now) {
      return NextResponse.json({
        valid: false,
        error: 'This promotion has not started yet'
      })
    }
    
    if (promotion.endDate && promotion.endDate < now) {
      return NextResponse.json({
        valid: false,
        error: 'This promotion has expired'
      })
    }
    
    // Check usage limits
    if (promotion.maxUsesTotal && promotion.usedCount >= promotion.maxUsesTotal) {
      return NextResponse.json({
        valid: false,
        error: 'This promotion has reached its usage limit'
      })
    }
    
    // Check minimum purchase
    if (promotion.minimumPurchase && cartTotal < promotion.minimumPurchase) {
      return NextResponse.json({
        valid: false,
        error: `Minimum purchase of $${promotion.minimumPurchase.toFixed(2)} required`
      })
    }
    
    // Check product targeting
    if (promotion.productIds && productIds) {
      const targetedProducts: string[] = JSON.parse(promotion.productIds)
      const hasTargetedProduct = productIds.some(id => targetedProducts.includes(id))
      if (!hasTargetedProduct) {
        return NextResponse.json({
          valid: false,
          error: 'This promotion does not apply to items in your cart'
        })
      }
    }
    
    // Check customer email targeting
    if (promotion.customerEmails && customerEmail) {
      const targetedEmails: string[] = JSON.parse(promotion.customerEmails)
      if (!targetedEmails.includes(customerEmail.toLowerCase())) {
        return NextResponse.json({
          valid: false,
          error: 'This promotion is not available for your account'
        })
      }
    }
    
    // Calculate discount
    let discount = 0
    let discountDescription = ''
    
    switch (promotion.type) {
      case 'PERCENTAGE':
        discount = cartTotal * (promotion.value / 100)
        discountDescription = `${promotion.value}% off`
        break
      case 'FIXED_AMOUNT':
        discount = Math.min(promotion.value, cartTotal)
        discountDescription = `$${promotion.value.toFixed(2)} off`
        break
      case 'FREE_SHIPPING':
        discount = 0 // Shipping discount handled separately
        discountDescription = 'Free shipping'
        break
      case 'BOGO':
        discountDescription = 'Buy One Get One'
        break
      case 'BUY_X_GET_Y':
        discountDescription = `Buy more, save ${promotion.value}%`
        break
    }
    
    return NextResponse.json({
      valid: true,
      promotion: {
        id: promotion.id,
        name: promotion.name,
        type: promotion.type,
        value: promotion.value,
        discount,
        discountDescription,
        freeShipping: promotion.type === 'FREE_SHIPPING'
      }
    })
  } catch (error) {
    console.error('Error validating promotion:', error)
    return NextResponse.json(
      { valid: false, error: 'Failed to validate promotion' },
      { status: 500 }
    )
  }
}
