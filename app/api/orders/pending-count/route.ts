import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/orders/pending-count - Get count of pending orders
export async function GET() {
  try {
    const count = await prisma.order.count({
      where: {
        status: 'PENDING',
      },
    })

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Failed to fetch pending orders count:', error)
    return NextResponse.json({ count: 0 }, { status: 500 })
  }
}
