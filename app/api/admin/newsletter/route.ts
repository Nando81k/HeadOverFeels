import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'
import { normalizeNewsletterEmail } from '@/lib/newsletter/types'
import { getNewsletterCampaignDelegate } from '@/lib/newsletter/campaign-delegate'

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback
  }
  return parsed
}

// GET - List newsletter subscribers (admin only)
export async function GET(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request)

    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parsePositiveInteger(searchParams.get('page'), 1)
    const limit = parsePositiveInteger(searchParams.get('limit'), 50)
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status') || 'all' // all, active, unsubscribed
    const source = searchParams.get('source') || 'all'

    const skip = (page - 1) * limit

    const where: {
      email?: { contains: string; mode: 'insensitive' }
      isActive?: boolean
      source?: string
    } = {}

    if (search) {
      where.email = { contains: search, mode: 'insensitive' }
    }

    if (status === 'active') {
      where.isActive = true
    } else if (status === 'unsubscribed') {
      where.isActive = false
    }

    if (source !== 'all') {
      where.source = source
    }

    const [subscribers, totalSubscribers] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.newsletterSubscriber.count({ where }),
    ])

    const pageEmails = subscribers.map((subscriber) => normalizeNewsletterEmail(subscriber.email))
    const matchingCustomers = pageEmails.length
      ? await prisma.customer.findMany({
          where: {
            email: {
              in: pageEmails,
            },
          },
          select: {
            email: true,
            name: true,
          },
        })
      : []

    const customerMap = new Map(
      matchingCustomers.map((customer) => [normalizeNewsletterEmail(customer.email), customer])
    )

    const campaignDelegate = getNewsletterCampaignDelegate()
    const campaignCountsPromise = campaignDelegate
      ? Promise.all([
          campaignDelegate.count(),
          campaignDelegate.count({ where: { status: 'DRAFT' } }),
          campaignDelegate.count({ where: { status: 'QUEUED' } }),
          campaignDelegate.count({ where: { status: 'SENT' } }),
          campaignDelegate.count({ where: { status: 'FAILED' } }),
        ])
      : Promise.resolve([0, 0, 0, 0, 0] as const)

    const [activeSubscribers, unsubscribedSubscribers, newLast30Days, customerSubscribers, sourceStats, campaignCounts] = await Promise.all([
      prisma.newsletterSubscriber.count({ where: { isActive: true } }),
      prisma.newsletterSubscriber.count({ where: { isActive: false } }),
      prisma.newsletterSubscriber.count({
        where: {
          isActive: true,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.customer.count({ where: { newsletter: true } }),
      prisma.newsletterSubscriber.groupBy({
        by: ['source'],
        _count: {
          source: true,
        },
        where: {
          isActive: true,
        },
      }),
      campaignCountsPromise,
    ])

    return NextResponse.json({
      subscribers: subscribers.map((subscriber) => {
        const normalizedEmail = normalizeNewsletterEmail(subscriber.email)
        const customer = customerMap.get(normalizedEmail)

        return {
          id: subscriber.id,
          email: normalizedEmail,
          name: customer?.name || null,
          source: subscriber.source,
          sourceDetails: subscriber.sourceDetails,
          isActive: subscriber.isActive,
          isVerified: subscriber.isVerified,
          isCustomer: Boolean(customer),
          createdAt: subscriber.createdAt,
          unsubscribedAt: subscriber.unsubscribedAt,
          unsubscribeReason: subscriber.unsubscribeReason,
          utmSource: subscriber.utmSource,
          utmMedium: subscriber.utmMedium,
          utmCampaign: subscriber.utmCampaign,
        }
      }),
      pagination: {
        page,
        limit,
        totalSubscribers,
        totalPages: Math.ceil(totalSubscribers / limit),
      },
      stats: {
        activeSubscribers,
        unsubscribed: unsubscribedSubscribers,
        newLast30Days,
        customerSubscribers,
        totalActive: activeSubscribers,
        bySource: sourceStats.reduce((accumulator, sourceStat) => {
          if (sourceStat.source) {
            accumulator[sourceStat.source] = sourceStat._count.source
          }
          return accumulator
        }, {} as Record<string, number>),
        campaigns: {
          total: campaignCounts[0],
          draft: campaignCounts[1],
          queued: campaignCounts[2],
          sent: campaignCounts[3],
          failed: campaignCounts[4],
        },
      },
    })
  } catch (error) {
    console.error('Failed to fetch newsletter subscribers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscribers' },
      { status: 500 }
    )
  }
}

// POST - Export subscribers list
export async function POST(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request)

    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, format = 'csv' } = body as { action: string; format?: 'csv' | 'json' }

    if (action !== 'export') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      select: {
        email: true,
        source: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const normalizedEmails = subscribers.map((subscriber) => normalizeNewsletterEmail(subscriber.email))
    const customers = normalizedEmails.length
      ? await prisma.customer.findMany({
          where: {
            email: {
              in: normalizedEmails,
            },
          },
          select: {
            email: true,
            name: true,
          },
        })
      : []

    const customerMap = new Map(customers.map((customer) => [normalizeNewsletterEmail(customer.email), customer]))

    const rows = subscribers.map((subscriber) => {
      const normalizedEmail = normalizeNewsletterEmail(subscriber.email)
      const customer = customerMap.get(normalizedEmail)

      return {
        email: normalizedEmail,
        name: customer?.name || null,
        source: subscriber.source || 'unknown',
        subscribed_at: subscriber.createdAt.toISOString(),
      }
    })

    if (format === 'csv') {
      const csvHeader = 'email,name,source,subscribed_at\n'
      const csvBody = rows
        .map((row) => `${row.email},"${row.name || ''}",${row.source},${row.subscribed_at}`)
        .join('\n')

      return new NextResponse(csvHeader + csvBody, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    return NextResponse.json({ subscribers: rows })
  } catch (error) {
    console.error('Failed to export subscribers:', error)
    return NextResponse.json(
      { error: 'Failed to export subscribers' },
      { status: 500 }
    )
  }
}
