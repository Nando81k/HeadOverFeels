/**
 * Legacy compatibility route.
 *
 * Canonical admin customer list is /api/admin/customers.
 * This endpoint is retained for backwards compatibility and now requires admin auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/admin'
import { parseAdminCustomerQuery } from '@/lib/customers/admin-customer-query'
import { listAdminCustomers } from '@/lib/customers/admin-customer-service'

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
      customers: result.customers,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      tiers: result.tiers,
      legacy: true,
    })
  } catch (error) {
    console.error('Failed to fetch legacy customers list:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}
