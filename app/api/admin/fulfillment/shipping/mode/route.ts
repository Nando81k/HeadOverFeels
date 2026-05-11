import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/admin'
import { isEasyPostConfigured } from '@/lib/shipping/easypost'

// GET /api/admin/fulfillment/shipping/mode
//
// Reports whether the shipping integration is connected to a real carrier
// network (EasyPost API key configured) or running in demo mode (synthetic
// rates + HTML labels). The fulfillment workbench's rate picker uses this to
// surface a LIVE / DEMO pill so the operator never confuses a $0 mock label
// with a real carrier-issued shipment.
export async function GET(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ live: isEasyPostConfigured() })
  } catch (error) {
    console.error('Failed to read shipping mode:', error)
    return NextResponse.json({ error: 'Failed to read shipping mode' }, { status: 500 })
  }
}
