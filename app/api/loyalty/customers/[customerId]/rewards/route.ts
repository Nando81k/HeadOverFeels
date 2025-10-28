import { NextResponse } from 'next/server'
import { getAvailableRewards } from '@/lib/loyalty/service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params

    const rewards = await getAvailableRewards(customerId)

    return NextResponse.json({ data: rewards })
  } catch (error) {
    console.error('Error fetching available rewards:', error)
    return NextResponse.json(
      { error: 'Failed to fetch available rewards' },
      { status: 500 }
    )
  }
}
