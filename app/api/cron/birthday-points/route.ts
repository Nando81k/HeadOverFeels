import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { awardBirthdayPoints } from '@/lib/loyalty/service'

/**
 * POST /api/cron/birthday-points
 * 
 * Cron job endpoint to award birthday points to customers
 * Should be scheduled to run daily (e.g., via Vercel Cron, GitHub Actions, or external scheduler)
 * 
 * Security: Add authorization header check in production
 * Example Vercel Cron config in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/birthday-points",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

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
        await awardBirthdayPoints(customer.id)
        results.push({
          customerId: customer.id,
          email: customer.email,
          success: true,
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

// GET endpoint for manual testing
export async function GET(request: NextRequest) {
  return POST(request)
}
