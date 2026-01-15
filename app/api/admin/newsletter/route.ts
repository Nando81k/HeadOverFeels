import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'

// GET - List all newsletter subscribers (admin only)
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request)
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'all' // all, active, unsubscribed
    const source = searchParams.get('source') || 'all'
    const includeCustomers = searchParams.get('includeCustomers') !== 'false'
    
    const skip = (page - 1) * limit

    // Build filter for newsletter subscribers
    const subscriberWhere: Record<string, unknown> = {}
    
    if (search) {
      subscriberWhere.email = { contains: search, mode: 'insensitive' }
    }
    
    if (status === 'active') {
      subscriberWhere.isActive = true
    } else if (status === 'unsubscribed') {
      subscriberWhere.isActive = false
    }
    
    if (source !== 'all') {
      subscriberWhere.source = source
    }

    // Get newsletter subscribers
    const [subscribers, subscriberCount] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where: subscriberWhere,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.newsletterSubscriber.count({ where: subscriberWhere }),
    ])

    // Also get subscribed customers if requested
    let customerSubscribers: Array<{
      id: string
      email: string
      name: string | null
      createdAt: Date
      source: string
      isActive: boolean
    }> = []
    let customerCount = 0
    
    if (includeCustomers && page === 1) {
      const customerWhere: Record<string, unknown> = {
        newsletter: true,
      }
      
      if (search) {
        customerWhere.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ]
      }
      
      const [customers, count] = await Promise.all([
        prisma.customer.findMany({
          where: customerWhere,
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.customer.count({ where: customerWhere }),
      ])
      
      customerSubscribers = customers.map(c => ({
        ...c,
        source: 'customer_account',
        isActive: true,
      }))
      customerCount = count
    }

    // Get stats
    const stats = await Promise.all([
      prisma.newsletterSubscriber.count({ where: { isActive: true } }),
      prisma.newsletterSubscriber.count({ where: { isActive: false } }),
      prisma.newsletterSubscriber.count({ 
        where: { 
          createdAt: { 
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
          },
          isActive: true,
        } 
      }),
      prisma.customer.count({ where: { newsletter: true } }),
    ])

    // Get source breakdown
    const sourceStats = await prisma.newsletterSubscriber.groupBy({
      by: ['source'],
      _count: { source: true },
      where: { isActive: true },
    })

    return NextResponse.json({
      subscribers: [
        ...customerSubscribers.map((c: typeof customerSubscribers[0]) => ({
          id: c.id,
          email: c.email,
          name: c.name,
          source: c.source,
          isActive: c.isActive,
          isCustomer: true,
          createdAt: c.createdAt,
        })),
        ...subscribers.map((s: typeof subscribers[0]) => ({
          id: s.id,
          email: s.email,
          name: null,
          source: s.source,
          sourceDetails: s.sourceDetails,
          isActive: s.isActive,
          isVerified: s.isVerified,
          isCustomer: false,
          createdAt: s.createdAt,
          unsubscribedAt: s.unsubscribedAt,
          unsubscribeReason: s.unsubscribeReason,
          utmSource: s.utmSource,
          utmMedium: s.utmMedium,
          utmCampaign: s.utmCampaign,
        })),
      ],
      pagination: {
        page,
        limit,
        totalSubscribers: subscriberCount,
        totalCustomerSubscribers: customerCount,
        totalPages: Math.ceil((subscriberCount + customerCount) / limit),
      },
      stats: {
        activeSubscribers: stats[0],
        unsubscribed: stats[1],
        newLast30Days: stats[2],
        customerSubscribers: stats[3],
        totalActive: stats[0] + stats[3],
        bySource: sourceStats.reduce((acc, s) => {
          if (s.source) acc[s.source] = s._count.source
          return acc
        }, {} as Record<string, number>),
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
    const isAdmin = await verifyAdmin(request)
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, format = 'csv' } = body as { action: string; format?: string }

    if (action !== 'export') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    // Get all active subscribers
    const [subscribers, customerSubscribers] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where: { isActive: true },
        select: {
          email: true,
          source: true,
          createdAt: true,
        },
      }),
      prisma.customer.findMany({
        where: { newsletter: true },
        select: {
          email: true,
          name: true,
          createdAt: true,
        },
      }),
    ])

    const allEmails = [
      ...subscribers.map((s: typeof subscribers[0]) => ({
        email: s.email,
        name: null as string | null,
        source: s.source || 'unknown',
        subscribed_at: s.createdAt.toISOString(),
      })),
      ...customerSubscribers.map((c: typeof customerSubscribers[0]) => ({
        email: c.email,
        name: c.name,
        source: 'customer_account',
        subscribed_at: c.createdAt.toISOString(),
      })),
    ]

    if (format === 'csv') {
      const csvHeader = 'email,name,source,subscribed_at\n'
      const csvBody = allEmails
        .map(e => `${e.email},"${e.name || ''}",${e.source},${e.subscribed_at}`)
        .join('\n')
      
      return new NextResponse(csvHeader + csvBody, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    return NextResponse.json({ subscribers: allEmails })
  } catch (error) {
    console.error('Failed to export subscribers:', error)
    return NextResponse.json(
      { error: 'Failed to export subscribers' },
      { status: 500 }
    )
  }
}
