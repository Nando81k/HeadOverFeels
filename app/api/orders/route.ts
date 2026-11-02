import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { verifyAdmin } from '@/lib/auth/admin'
import { getPaginationParams, createPaginatedResponse } from '@/lib/validation/schemas'
import {
  parseStatuses,
  parsePaymentStatus,
  parsePositiveNumber,
  parseDateValue,
  parseSort,
} from '@/lib/orders/admin-order-query'

/**
 * GET /api/orders - Admin order list (used by the admin `CommandPalette`).
 *
 * Phase 4 (storefront rebuild, Task 8): admin-only. The previous version
 * trusted the `x-user-email` / `x-user-admin` request headers, which any
 * client could set, and so leaked every order to anyone who asked. The
 * customer-facing order list now comes from Shopify's Customer Account API
 * under `/account/orders`; the legacy `POST` (custom checkout order
 * creation) is gone with the custom checkout.
 */
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Validate pagination parameters
    const { searchParams } = new URL(request.url)
    const { page, limit } = getPaginationParams(searchParams)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const statuses = parseStatuses(searchParams.get('statuses'), status)
    const paymentStatus = parsePaymentStatus(searchParams.get('paymentStatus'))
    const minTotal = parsePositiveNumber(searchParams.get('minTotal'))
    const maxTotal = parsePositiveNumber(searchParams.get('maxTotal'))
    const dateFrom = parseDateValue(searchParams.get('dateFrom'))
    const dateTo = parseDateValue(searchParams.get('dateTo'))
    const { sortBy, sortDir } = parseSort(
      searchParams.get('sortBy'),
      searchParams.get('sortDir')
    )

    const where: Prisma.OrderWhereInput = {}

    if (statuses.length > 0) {
      where.status = { in: statuses }
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus
    }

    if (typeof minTotal === 'number' || typeof maxTotal === 'number') {
      where.total = {
        ...(typeof minTotal === 'number' ? { gte: minTotal } : {}),
        ...(typeof maxTotal === 'number' ? { lte: maxTotal } : {}),
      }
    }

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      }
    }

    // Search by email, order number, or customer name
    if (search) {
      const cleanSearch = search.substring(0, 255).trim()
      where.OR = [
        { orderNumber: { contains: cleanSearch, mode: 'insensitive' } },
        { customerEmail: { contains: cleanSearch, mode: 'insensitive' } },
        {
          shippingAddress: {
            OR: [
              { firstName: { contains: cleanSearch, mode: 'insensitive' } },
              { lastName: { contains: cleanSearch, mode: 'insensitive' } },
            ],
          },
        },
        {
          customer: {
            OR: [
              { name: { contains: cleanSearch, mode: 'insensitive' } },
              { email: { contains: cleanSearch, mode: 'insensitive' } },
            ],
          },
        },
      ]
    }

    const orderBy: Prisma.OrderOrderByWithRelationInput[] =
      sortBy === 'status'
        ? [{ status: sortDir }, { createdAt: 'desc' }]
        : sortBy === 'total'
        ? [{ total: sortDir }, { createdAt: 'desc' }]
        : [{ createdAt: sortDir }]

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: true,
              productVariant: true,
            },
          },
          customer: true,
          shippingAddress: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    return NextResponse.json(
      createPaginatedResponse(orders, total, page, limit)
    )
  } catch (error) {
    console.error('Orders fetch error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch orders',
      },
      { status: 500 }
    )
  }
}
