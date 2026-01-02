import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'
import { ExpenseStatus } from '@prisma/client'

// GET - List expenses with filtering and pagination
export async function GET(request: NextRequest) {
  const adminVerified = await verifyAdmin(request)
  if (!adminVerified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const categoryId = searchParams.get('categoryId')
    const status = searchParams.get('status') as ExpenseStatus | null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'date'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build where clause
    const where: Record<string, unknown> = {}
    
    if (categoryId) where.categoryId = categoryId
    if (status) where.status = status
    if (startDate || endDate) {
      where.date = {}
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate)
      if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate)
    }
    if (search) {
      where.OR = [
        { description: { contains: search } },
        { vendor: { contains: search } },
        { notes: { contains: search } }
      ]
    }

    // Get total count
    const total = await prisma.expense.count({ where })

    // Get expenses
    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true }
        },
        invoice: {
          select: { id: true, invoiceNumber: true }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit
    })

    // Get summary stats for the filtered period
    const summary = await prisma.expense.aggregate({
      where,
      _sum: { amount: true },
      _avg: { amount: true },
      _count: true
    })

    return NextResponse.json({
      expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        totalAmount: summary._sum.amount || 0,
        avgAmount: summary._avg.amount || 0,
        count: summary._count
      }
    })
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

// POST - Create new expense
export async function POST(request: NextRequest) {
  const adminVerified = await verifyAdmin(request)
  if (!adminVerified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      categoryId,
      description,
      amount,
      date,
      vendor,
      receiptUrl,
      notes,
      isTaxDeductible,
      taxCategory,
      paymentMethod,
      isRecurring,
      recurringFrequency,
      invoiceId
    } = body

    // Validation
    if (!categoryId) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    }
    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }
    if (amount === undefined || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }

    // Verify category exists
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId }
    })
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 400 })
    }

    const expense = await prisma.expense.create({
      data: {
        categoryId,
        description,
        amount,
        date: date ? new Date(date) : new Date(),
        vendor,
        receiptUrl,
        notes,
        isTaxDeductible: isTaxDeductible || false,
        taxCategory,
        paymentMethod,
        isRecurring: isRecurring || false,
        recurringFrequency,
        invoiceId,
        status: 'RECORDED'
      },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true }
        }
      }
    })

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
