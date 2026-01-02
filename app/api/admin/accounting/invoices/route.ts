import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'
import { InvoiceStatus } from '@prisma/client'

// Helper to generate invoice number
function generateInvoiceNumber(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `INV-${year}${month}-${random}`
}

// GET - List invoices with filtering and pagination
export async function GET(request: NextRequest) {
  const adminVerified = await verifyAdmin(request)
  if (!adminVerified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') as InvoiceStatus | null
    const search = searchParams.get('search')
    const overdue = searchParams.get('overdue') === 'true'
    const sortBy = searchParams.get('sortBy') || 'dueDate'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    // Build where clause
    const where: Record<string, unknown> = {}
    
    if (status) where.status = status
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { vendorName: { contains: search } },
        { description: { contains: search } }
      ]
    }
    if (overdue) {
      where.status = { in: ['PENDING'] }
      where.dueDate = { lt: new Date() }
    }

    // Get total count
    const total = await prisma.invoice.count({ where })

    // Get invoices
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        _count: {
          select: { expenses: true }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit
    })

    // Get summary stats
    const [pending, overdueSummary, paidThisMonth] = await Promise.all([
      prisma.invoice.aggregate({
        where: { status: 'PENDING' },
        _sum: { total: true },
        _count: true
      }),
      prisma.invoice.aggregate({
        where: {
          status: 'PENDING',
          dueDate: { lt: new Date() }
        },
        _sum: { total: true },
        _count: true
      }),
      prisma.invoice.aggregate({
        where: {
          status: 'PAID',
          paidDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: { total: true },
        _count: true
      })
    ])

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        pendingAmount: pending._sum.total || 0,
        pendingCount: pending._count,
        overdueAmount: overdueSummary._sum.total || 0,
        overdueCount: overdueSummary._count,
        paidThisMonth: paidThisMonth._sum.total || 0,
        paidThisMonthCount: paidThisMonth._count
      }
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

// POST - Create new invoice
export async function POST(request: NextRequest) {
  const adminVerified = await verifyAdmin(request)
  if (!adminVerified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      vendorName,
      vendorEmail,
      vendorAddress,
      description,
      subtotal,
      tax,
      issueDate,
      dueDate,
      documentUrl,
      notes,
      status
    } = body

    // Validation
    if (!vendorName) {
      return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 })
    }
    if (subtotal === undefined || subtotal < 0) {
      return NextResponse.json({ error: 'Valid subtotal is required' }, { status: 400 })
    }
    if (!dueDate) {
      return NextResponse.json({ error: 'Due date is required' }, { status: 400 })
    }

    const taxAmount = tax || 0
    const total = subtotal + taxAmount

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        vendorName,
        vendorEmail,
        vendorAddress,
        description,
        subtotal,
        tax: taxAmount,
        total,
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        dueDate: new Date(dueDate),
        documentUrl,
        notes,
        status: status || 'PENDING'
      }
    })

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
