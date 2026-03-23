import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateCustomerSegment } from '@/lib/customer-segments'
import type { ParsedAdminCustomerQuery } from './admin-customer-query'

export type AdminCustomerListItem = {
  id: string
  email: string
  name: string | null
  phone: string | null
  totalSpent: number
  totalOrders: number
  lastOrderDate: Date | null
  avgOrderValue: number
  createdAt: Date
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
  segment: string
  tier: {
    id: string
    name: string
    slug: string
  } | null
}

export type AdminCustomerTierOption = {
  id: string
  name: string
  slug: string
}

function buildAdminCustomerWhere(query: ParsedAdminCustomerQuery): Prisma.CustomerWhereInput {
  const whereClauses: Prisma.CustomerWhereInput[] = [{ isAdmin: { not: true } }]

  if (query.search) {
    whereClauses.push({
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ],
    })
  }

  if (typeof query.minSpent === 'number') {
    whereClauses.push({
      totalSpent: { gte: query.minSpent },
    })
  }

  if (typeof query.minOrders === 'number') {
    whereClauses.push({
      totalOrders: { gte: query.minOrders },
    })
  }

  if (query.tier) {
    whereClauses.push({
      OR: [
        { loyaltyTierId: query.tier },
        { loyaltyTier: { is: { slug: query.tier } } },
      ],
    })
  }

  if (whereClauses.length === 1) {
    return whereClauses[0]
  }

  return { AND: whereClauses }
}

function buildAdminCustomerOrderBy(query: ParsedAdminCustomerQuery): Prisma.CustomerOrderByWithRelationInput {
  switch (query.sortBy) {
    case 'name':
      return { name: query.sortDir }
    case 'email':
      return { email: query.sortDir }
    case 'totalSpent':
      return { totalSpent: query.sortDir }
    case 'totalOrders':
      return { totalOrders: query.sortDir }
    case 'lastOrderDate':
      return { lastOrderDate: query.sortDir }
    case 'currentPoints':
      return { currentPoints: query.sortDir }
    case 'createdAt':
    default:
      return { createdAt: query.sortDir }
  }
}

const CUSTOMER_LIST_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  totalSpent: true,
  totalOrders: true,
  lastOrderDate: true,
  avgOrderValue: true,
  createdAt: true,
  currentPoints: true,
  lifetimePoints: true,
  annualPointsEarned: true,
  loyaltyTier: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} satisfies Prisma.CustomerSelect

function toAdminCustomerListItem(
  customer: Prisma.CustomerGetPayload<{ select: typeof CUSTOMER_LIST_SELECT }>
): AdminCustomerListItem {
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    totalSpent: customer.totalSpent,
    totalOrders: customer.totalOrders,
    lastOrderDate: customer.lastOrderDate,
    avgOrderValue: customer.avgOrderValue,
    createdAt: customer.createdAt,
    currentPoints: customer.currentPoints,
    lifetimePoints: customer.lifetimePoints,
    annualPointsEarned: customer.annualPointsEarned,
    segment: calculateCustomerSegment({
      totalSpent: customer.totalSpent,
      totalOrders: customer.totalOrders,
      lastOrderDate: customer.lastOrderDate,
      createdAt: customer.createdAt,
    }),
    tier: customer.loyaltyTier
      ? {
          id: customer.loyaltyTier.id,
          name: customer.loyaltyTier.name,
          slug: customer.loyaltyTier.slug,
        }
      : null,
  }
}

export async function listAdminCustomers(query: ParsedAdminCustomerQuery): Promise<{
  customers: AdminCustomerListItem[]
  total: number
  page: number
  limit: number
  tiers: AdminCustomerTierOption[]
}> {
  const where = buildAdminCustomerWhere(query)
  const orderBy = buildAdminCustomerOrderBy(query)

  const tiersPromise = prisma.loyaltyTier.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { minAnnualPoints: 'asc' },
  })

  if (query.segment) {
    const [allCustomers, tiers] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy,
        select: CUSTOMER_LIST_SELECT,
      }),
      tiersPromise,
    ])

    const withSegments = allCustomers.map(toAdminCustomerListItem)
    const filtered = withSegments.filter((customer) => customer.segment === query.segment)
    const paged = filtered.slice(query.skip, query.skip + query.limit)

    return {
      customers: paged,
      total: filtered.length,
      page: query.page,
      limit: query.limit,
      tiers,
    }
  }

  const [customers, total, tiers] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy,
      skip: query.skip,
      take: query.limit,
      select: CUSTOMER_LIST_SELECT,
    }),
    prisma.customer.count({ where }),
    tiersPromise,
  ])

  return {
    customers: customers.map(toAdminCustomerListItem),
    total,
    page: query.page,
    limit: query.limit,
    tiers,
  }
}
