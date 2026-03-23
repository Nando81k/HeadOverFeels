import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/admin'
import { createPaginatedResponse } from '@/lib/validation/schemas'
import { parseAdminCustomerQuery } from '@/lib/customers/admin-customer-query'
import { listAdminCustomers } from '@/lib/customers/admin-customer-service'

// GET /api/admin/customers - canonical admin customer list
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const query = parseAdminCustomerQuery(searchParams)
    const result = await listAdminCustomers(query)

    return NextResponse.json({
      ...createPaginatedResponse(result.customers, result.total, result.page, result.limit),
      tiers: result.tiers,
    })
  } catch (error) {
    console.error('Failed to fetch admin customers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}
