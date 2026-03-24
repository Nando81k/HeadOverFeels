import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'

function parseId(value: string | null): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  return trimmed
}

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

type FulfillmentReadinessStep = {
  id: 'validate_address' | 'buy_label' | 'print_label' | 'mark_shipped' | 'notify_customer'
  label: string
  ready: boolean
  reason?: string
}

function hasCompleteAddress(
  address:
    | {
        firstName: string
        lastName: string
        address1: string
        city: string
        state: string
        postalCode: string
        country: string
      }
    | null
): boolean {
  if (!address) return false
  return Boolean(
    address.firstName?.trim() &&
      address.lastName?.trim() &&
      address.address1?.trim() &&
      address.city?.trim() &&
      address.state?.trim() &&
      address.postalCode?.trim() &&
      address.country?.trim()
  )
}

function deriveFulfillmentReadiness(order: {
  status: string
  paymentStatus: string
  trackingNumber: string | null
  carrier: string | null
  trackingUrl: string | null
  shippingAddress:
    | {
        firstName: string
        lastName: string
        address1: string
        city: string
        state: string
        postalCode: string
        country: string
      }
    | null
} | null) {
  if (!order) {
    return {
      hasOrder: false,
      primaryAction: 'OPEN_CASE' as const,
      steps: [] as FulfillmentReadinessStep[],
    }
  }

  const hasAddress = hasCompleteAddress(order.shippingAddress)
  const hasTracking = Boolean(order.trackingNumber && order.trackingNumber.trim().length > 0)
  const hasCarrier = Boolean(order.carrier && order.carrier.trim().length > 0)
  const isPaid = order.paymentStatus === 'PAID'
  const isShipped = order.status === 'SHIPPED' || order.status === 'DELIVERED'

  const steps: FulfillmentReadinessStep[] = [
    {
      id: 'validate_address',
      label: 'Validate Address',
      ready: hasAddress,
      reason: hasAddress ? undefined : 'Shipping address is incomplete.',
    },
    {
      id: 'buy_label',
      label: 'Buy Label',
      ready: isPaid && hasAddress && !hasTracking,
      reason: !isPaid
        ? 'Order must be paid first.'
        : !hasAddress
          ? 'Address must be valid before label purchase.'
          : hasTracking
            ? 'Tracking already exists.'
            : undefined,
    },
    {
      id: 'print_label',
      label: 'Print Label',
      ready: hasTracking && (hasCarrier || Boolean(order.trackingUrl)),
      reason: hasTracking ? undefined : 'Buy label first to print.',
    },
    {
      id: 'mark_shipped',
      label: 'Mark Shipped',
      ready: hasTracking && !isShipped,
      reason: hasTracking ? (isShipped ? 'Order already marked shipped.' : undefined) : 'Tracking is required.',
    },
    {
      id: 'notify_customer',
      label: 'Notify Customer',
      ready: hasTracking && hasCarrier,
      reason: hasTracking ? (hasCarrier ? undefined : 'Carrier is required to send update.') : 'Tracking is required.',
    },
  ]

  const primaryAction =
    !hasAddress
      ? 'FIX_ADDRESS'
      : !isPaid
        ? 'OPEN_CASE'
        : !hasTracking
          ? 'BUY_LABEL'
          : !isShipped
            ? 'MARK_SHIPPED'
            : hasCarrier
              ? 'SEND_TRACKING_UPDATE'
              : 'OPEN_CASE'

  return {
    hasOrder: true,
    primaryAction,
    steps,
  }
}

// GET /api/admin/fulfillment/context?orderId=...&ticketId=...
export async function GET(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orderId = parseId(searchParams.get('orderId'))
    const ticketId = parseId(searchParams.get('ticketId'))

    if (!orderId && !ticketId) {
      return NextResponse.json({ error: 'Provide orderId or ticketId' }, { status: 400 })
    }

    let selectedTicket = ticketId
      ? await prisma.supportTicket.findUnique({
          where: { id: ticketId },
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            messages: {
              orderBy: {
                createdAt: 'asc',
              },
              take: 200,
            },
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                paymentStatus: true,
                total: true,
                trackingNumber: true,
              },
            },
          },
        })
      : null

    const resolvedOrderId = orderId || selectedTicket?.orderId || null

    const order = resolvedOrderId
      ? await prisma.order.findUnique({
          where: { id: resolvedOrderId },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                totalSpent: true,
                totalOrders: true,
                currentPoints: true,
                loyaltyTier: {
                  select: {
                    id: true,
                    name: true,
                    pointMultiplier: true,
                  },
                },
              },
            },
            shippingAddress: true,
            billingAddress: true,
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    images: true,
                  },
                },
                productVariant: {
                  select: {
                    id: true,
                    sku: true,
                    size: true,
                    color: true,
                  },
                },
              },
            },
          },
        })
      : null

    const resolvedCustomerId = order?.customerId || selectedTicket?.customerId || null

    const [relatedTickets, customerSnapshot, recentOrders, recentTickets, loyaltyTiers] = await Promise.all([
      resolvedOrderId
        ? prisma.supportTicket.findMany({
            where: {
              orderId: resolvedOrderId,
            },
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                },
              },
              _count: {
                select: {
                  messages: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 30,
          })
        : selectedTicket
          ? prisma.supportTicket.findMany({
              where: {
                customerId: selectedTicket.customerId || undefined,
              },
              include: {
                assignedTo: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                _count: {
                  select: {
                    messages: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 30,
            })
          : [],
      resolvedCustomerId
        ? prisma.customer.findUnique({
            where: {
              id: resolvedCustomerId,
            },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              birthday: true,
              newsletter: true,
              smsOptIn: true,
              totalSpent: true,
              totalOrders: true,
              currentPoints: true,
              lifetimePoints: true,
              annualPointsEarned: true,
              loyaltyTier: {
                select: {
                  id: true,
                  name: true,
                  pointMultiplier: true,
                },
              },
              notes: {
                orderBy: {
                  createdAt: 'desc',
                },
                take: 25,
              },
              pointsTransactions: {
                orderBy: {
                  createdAt: 'desc',
                },
                take: 20,
                select: {
                  id: true,
                  points: true,
                  type: true,
                  description: true,
                  createdAt: true,
                },
              },
              _count: {
                select: {
                  orders: true,
                  supportTickets: true,
                  notes: true,
                },
              },
            },
          })
        : null,
      resolvedCustomerId
        ? prisma.order.findMany({
            where: { customerId: resolvedCustomerId },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              paymentStatus: true,
              total: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 6,
          })
        : [],
      resolvedCustomerId
        ? prisma.supportTicket.findMany({
            where: { customerId: resolvedCustomerId },
            select: {
              id: true,
              ticketNumber: true,
              type: true,
              status: true,
              subject: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 6,
          })
        : [],
      prisma.loyaltyTier.findMany({
        where: {
          isActive: true,
          isInviteOnly: false,
        },
        select: {
          id: true,
          name: true,
          pointMultiplier: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { minAnnualPoints: 'asc' }],
      }),
    ])

    if (!selectedTicket && resolvedOrderId) {
      selectedTicket = await prisma.supportTicket.findFirst({
        where: { orderId: resolvedOrderId },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          messages: {
            orderBy: {
              createdAt: 'asc',
            },
            take: 200,
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              paymentStatus: true,
              total: true,
              trackingNumber: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    }

    return NextResponse.json({
      order,
      selectedTicket,
      relatedTickets,
      fulfillmentReadiness: deriveFulfillmentReadiness(order),
      customer: customerSnapshot
        ? {
            ...customerSnapshot,
            birthday: toIsoOrNull(customerSnapshot.birthday),
            notes: customerSnapshot.notes.map((note) => ({
              ...note,
              createdAt: note.createdAt.toISOString(),
              updatedAt: note.updatedAt.toISOString(),
            })),
            pointsTransactions: customerSnapshot.pointsTransactions.map((transaction) => ({
              ...transaction,
              createdAt: transaction.createdAt.toISOString(),
            })),
          }
        : null,
      recentOrders: recentOrders.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      recentTickets: recentTickets.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      loyaltyTiers,
    })
  } catch (error) {
    console.error('Failed to fetch fulfillment context:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fulfillment context' },
      { status: 500 }
    )
  }
}
