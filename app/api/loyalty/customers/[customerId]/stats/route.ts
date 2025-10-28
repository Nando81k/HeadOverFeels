import { NextResponse } from 'next/server'
import { getCustomerLoyaltyStats } from '@/lib/loyalty/service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params

    const stats = await getCustomerLoyaltyStats(customerId)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching loyalty stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch loyalty stats' },
      { status: 500 }
    )
  }
}
