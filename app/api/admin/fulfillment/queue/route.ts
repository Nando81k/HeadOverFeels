import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { verifyAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import {
  buildFulfillmentQueueItems,
  deriveFulfillmentQueueCounts,
  filterAndSortFulfillmentQueueItems,
  paginateFulfillmentQueueItems,
  parseFulfillmentFilterState,
} from '@/lib/fulfillment/queue'

// GET /api/admin/fulfillment/queue
export async function GET(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters = parseFulfillmentFilterState(searchParams)
    const normalizedSearch = filters.search.trim()

    const orderWhere: Prisma.OrderWhereInput = {
      OR: [
        {
          AND: [
            { status: { in: ['CONFIRMED', 'PROCESSING'] } },
            { paymentStatus: 'PAID' },
          ],
        },
      ],
    }

    const ticketWhere: Prisma.SupportTicketWhereInput = {
      OR: [
        {
          type: 'REFUND',
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED'] },
        },
        {
          returnRequested: true,
          returnApproved: null,
          status: { not: 'CLOSED' },
        },
        {
          type: 'SHIPPING_ISSUE',
          status: { not: 'CLOSED' },
        },
      ],
    }

    if (normalizedSearch.length > 0) {
      orderWhere.AND = [
        {
          OR: [
            { orderNumber: { contains: normalizedSearch, mode: 'insensitive' } },
            { customerEmail: { contains: normalizedSearch, mode: 'insensitive' } },
            { customer: { name: { contains: normalizedSearch, mode: 'insensitive' } } },
          ],
        },
      ]

      ticketWhere.AND = [
        {
          OR: [
            { ticketNumber: { contains: normalizedSearch, mode: 'insensitive' } },
            { subject: { contains: normalizedSearch, mode: 'insensitive' } },
            { customerEmail: { contains: normalizedSearch, mode: 'insensitive' } },
            { customerName: { contains: normalizedSearch, mode: 'insensitive' } },
            { orderNumber: { contains: normalizedSearch, mode: 'insensitive' } },
          ],
        },
      ]
    }

    const [orders, tickets] = await Promise.all([
      prisma.order.findMany({
        where: orderWhere,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              currentPoints: true,
              totalSpent: true,
              totalOrders: true,
              loyaltyTier: {
                select: {
                  name: true,
                },
              },
            },
          },
          shippingAddress: {
            select: {
              firstName: true,
              lastName: true,
              address1: true,
              city: true,
              state: true,
              postalCode: true,
              country: true,
            },
          },
          items: {
            select: {
              quantity: true,
              productVariant: {
                select: {
                  inventory: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 3000,
      }),
      prisma.supportTicket.findMany({
        where: ticketWhere,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              currentPoints: true,
              totalSpent: true,
              totalOrders: true,
              loyaltyTier: {
                select: {
                  name: true,
                },
              },
            },
          },
          order: {
            select: {
              id: true,
              status: true,
              paymentStatus: true,
              total: true,
              trackingNumber: true,
              carrier: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 3000,
      }),
    ])

    const allItems = buildFulfillmentQueueItems(orders, tickets)
    const counts = deriveFulfillmentQueueCounts(allItems)
    const filteredItems = filterAndSortFulfillmentQueueItems(allItems, filters)
    const paged = paginateFulfillmentQueueItems(filteredItems, filters.page, filters.limit)

    return NextResponse.json({
      data: paged.data,
      pagination: paged.pagination,
      counts,
      filters,
    })
  } catch (error) {
    console.error('Failed to fetch fulfillment queue:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fulfillment queue' },
      { status: 500 }
    )
  }
}
