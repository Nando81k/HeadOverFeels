import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const tiers = await prisma.loyaltyTier.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })

    return NextResponse.json(tiers)
  } catch (error) {
    console.error('Failed to fetch tiers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tiers' },
      { status: 500 }
    )
  }
}
