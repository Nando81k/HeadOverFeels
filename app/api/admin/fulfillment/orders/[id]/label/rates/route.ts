import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/admin'
import { getOutboundShippingRates } from '@/lib/shipping/easypost'

// POST /api/admin/fulfillment/orders/[id]/label/rates
//
// Creates an EasyPost shipment for the order's customer address and returns
// every rate the carrier network offers, sorted by delivery speed (fastest
// first) so overnight options surface above ground. The shipmentId is
// returned alongside so the subsequent purchase request can buy a specific
// rate from this exact shipment without re-creating one.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const result = await getOutboundShippingRates(id)

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Failed to fetch shipping rates',
          validationErrors: result.validationErrors,
        },
        { status: result.validationErrors ? 422 : 400 }
      )
    }

    const sortedRates = [...(result.rates || [])].sort((a, b) => {
      const daysA = a.deliveryDays ?? Number.POSITIVE_INFINITY
      const daysB = b.deliveryDays ?? Number.POSITIVE_INFINITY
      if (daysA !== daysB) return daysA - daysB
      return a.rate - b.rate
    })

    return NextResponse.json({
      success: true,
      shipmentId: result.shipmentId,
      rates: sortedRates,
    })
  } catch (error) {
    console.error('Failed to fetch outbound shipping rates:', error)
    return NextResponse.json({ error: 'Failed to fetch shipping rates' }, { status: 500 })
  }
}
