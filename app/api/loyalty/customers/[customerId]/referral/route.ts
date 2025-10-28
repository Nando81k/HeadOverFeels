import { NextResponse } from 'next/server'
import { getReferralCode } from '@/lib/loyalty/service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params

    const referralCode = await getReferralCode(customerId)

    return NextResponse.json({ data: referralCode })
  } catch (error) {
    console.error('Error fetching referral code:', error)
    return NextResponse.json(
      { error: 'Failed to fetch referral code' },
      { status: 500 }
    )
  }
}
