import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { awardBirthdayPoints } from '@/lib/loyalty/service'
import { verifyCronRequest } from '@/lib/security/cron'
import { sendBirthdayBonusEmail } from '@/lib/email/loyalty'

/**
 * POST /api/cron/birthday-points
 * 
 * Cron job endpoint to award birthday points to customers
 * Should be scheduled to run daily (e.g., via Vercel Cron, GitHub Actions, or external scheduler)
 * 
 * Security: HMAC-SHA256 signature verification required
 * Include headers:
 * - x-cron-signature: HMAC-SHA256(timestamp:method, CRON_SECRET)
 * - x-cron-timestamp: current timestamp in milliseconds
 * 
 * Example curl:
 * curl -X POST http://localhost:3000/api/cron/birthday-points \
 *   -H "x-cron-signature: <signature>" \
 *   -H "x-cron-timestamp: <timestamp>"
 */
export async function POST(request: NextRequest) {
  // Verify cron signature
  const verificationError = verifyCronRequest(request)
  if (verificationError) {
    return verificationError
  }

  try {

    // Get today's date (month and day only)
    const today = new Date()
    const todayMonth = today.getMonth() + 1 // JavaScript months are 0-indexed
    const todayDay = today.getDate()

    // Find all customers with birthdays today
    const customers = await prisma.customer.findMany({
      where: {
        birthday: {
          not: null,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        birthday: true,
      },
    })

    // Filter customers whose birthday is today
    const birthdayCustomers = customers.filter((customer) => {
      if (!customer.birthday) return false
      const birthday = new Date(customer.birthday)
      return (
        birthday.getMonth() + 1 === todayMonth &&
        birthday.getDate() === todayDay
      )
    })

    console.log(`Found ${birthdayCustomers.length} customers with birthdays today`)

    // Award birthday points to each customer
    const results = []
    for (const customer of birthdayCustomers) {
      try {
        // Award the points
        const transaction = await awardBirthdayPoints(customer.id)
        
        // Get updated customer info for email
        const updatedCustomer = await prisma.customer.findUnique({
          where: { id: customer.id },
          select: { 
            currentPoints: true,
            loyaltyTier: { select: { name: true } },
          },
        })
        
        // Send birthday email notification
        if (customer.email) {
          try {
            await sendBirthdayBonusEmail({
              customerEmail: customer.email,
              customerName: customer.name || 'Friend',
              pointsAwarded: transaction.points,
              currentPoints: updatedCustomer?.currentPoints || transaction.points,
              tierName: updatedCustomer?.loyaltyTier?.name || 'Member',
            })
            console.log(`Birthday email sent to ${customer.email}`)
          } catch (emailError) {
            console.error(`Failed to send birthday email to ${customer.email}:`, emailError)
            // Don't fail the whole operation if email fails
          }
        }
        
        results.push({
          customerId: customer.id,
          email: customer.email,
          success: true,
          emailSent: !!customer.email,
        })
        console.log(`Awarded birthday points to ${customer.email}`)
      } catch (error) {
        console.error(`Failed to award birthday points to ${customer.email}:`, error)
        results.push({
          customerId: customer.id,
          email: customer.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Birthday points awarded to ${successCount} customers`,
      stats: {
        totalBirthdays: birthdayCustomers.length,
        successful: successCount,
        failed: failureCount,
      },
      results,
    })
  } catch (error) {
    console.error('Birthday points cron job error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process birthday points',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

