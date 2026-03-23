import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { resend, emailConfig } from '@/lib/email/config'
import { generatePromoCodeEmail } from '@/lib/email/templates/promo-code'
import { ensureCanonicalSubscriberFromCustomer } from '@/lib/newsletter/subscribers'

// Schema for claiming a popup promo code
const ClaimCodeSchema = z.object({
  popupId: z.string(),
  email: z.string().email(),
})

// POST /api/popups/claim-code - Claim the promo code from a popup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { popupId, email } = ClaimCodeSchema.parse(body)
    const normalizedEmail = email.toLowerCase().trim()
    
    // Find the popup with its linked promotion
    const popup = await prisma.marketingPopup.findUnique({
      where: { id: popupId },
      include: {
        promotion: true,
      },
    })
    
    if (!popup) {
      return NextResponse.json(
        { error: 'Popup not found' },
        { status: 404 }
      )
    }
    
    // Create or find customer for email storage
    try {
      await prisma.customer.upsert({
        where: { email: normalizedEmail },
        create: { 
          email: normalizedEmail,
          newsletter: true, // Opt them in since they signed up via popup
        },
        update: {
          newsletter: true, // Enable newsletter for existing customers
        },
      })

      await ensureCanonicalSubscriberFromCustomer(normalizedEmail, 'popup_claim_code')
    } catch {
      // Ignore if customer already exists with conflicts
    }
    
    // If no promotion linked, just acknowledge the email signup
    if (!popup.promotion) {
      return NextResponse.json({
        success: true,
        hasPromo: false,
        message: 'Thank you for signing up!',
      })
    }
    
    const promo = popup.promotion
    
    // Check if promotion is still valid
    const now = new Date()
    if (!promo.isActive) {
      return NextResponse.json({
        success: true,
        hasPromo: false,
        message: 'This promotion has ended',
      })
    }
    
    if (promo.endDate && promo.endDate < now) {
      return NextResponse.json({
        success: true,
        hasPromo: false,
        message: 'This promotion has expired',
      })
    }
    
    if (promo.maxUsesTotal && promo.usedCount >= promo.maxUsesTotal) {
      return NextResponse.json({
        success: true,
        hasPromo: false,
        message: 'This promotion has reached its limit',
      })
    }
    
    // Build discount description
    let discountDescription = ''
    if (promo.type === 'PERCENTAGE') {
      discountDescription = `${promo.value}% off`
    } else if (promo.type === 'FIXED_AMOUNT') {
      discountDescription = `$${promo.value.toFixed(2)} off`
    } else if (promo.type === 'FREE_SHIPPING') {
      discountDescription = 'Free shipping'
    } else if (promo.type === 'BOGO') {
      discountDescription = 'Buy One Get One'
    } else if (promo.type === 'BUY_X_GET_Y') {
      discountDescription = `Buy more, save ${promo.value}%`
    }
    
    // Send email with promo code
    try {
      const emailHtml = generatePromoCodeEmail({
        promoCode: promo.code || '',
        discountDescription,
        promoName: promo.name,
        expiresAt: promo.endDate,
        minimumPurchase: promo.minimumPurchase,
      })
      
      await resend.emails.send({
        from: emailConfig.from,
        to: normalizedEmail,
        replyTo: emailConfig.replyTo,
        subject: `🎉 Your exclusive discount code: ${promo.code}`,
        html: emailHtml,
      })
    } catch (emailError) {
      console.error('Failed to send promo code email:', emailError)
      // Continue - we'll show the code on screen anyway
    }
    
    return NextResponse.json({
      success: true,
      hasPromo: true,
      promoCode: promo.code,
      discountDescription,
      promoName: promo.name,
      message: `Your code ${promo.code} has been sent to ${email}!`,
    })
  } catch (error) {
    console.error('Claim code error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to claim promo code' },
      { status: 500 }
    )
  }
}
