import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'

// GET - List all budgets with spending data
export async function GET(request: NextRequest) {
  const adminVerified = await verifyAdmin(request)
  if (!adminVerified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') // WEEKLY, MONTHLY, QUARTERLY, YEARLY
  const categoryId = searchParams.get('categoryId')
  const activeOnly = searchParams.get('activeOnly') === 'true'

  try {
    const where: Record<string, unknown> = {}
    
    if (period) where.period = period
    if (categoryId) where.categoryId = categoryId
    if (activeOnly) {
      const now = new Date()
      where.startDate = { lte: now }
      where.endDate = { gte: now }
    }

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true }
        }
      },
      orderBy: { startDate: 'desc' }
    })

    // Calculate actual spending for each budget
    const budgetsWithSpending = await Promise.all(
      budgets.map(async (budget) => {
        const spending = await prisma.expense.aggregate({
          where: {
            categoryId: budget.categoryId ?? undefined,
            date: {
              gte: budget.startDate,
              lte: budget.endDate
            },
            status: { in: ['RECORDED', 'APPROVED', 'PAID'] }
          },
          _sum: { amount: true }
        })

        const actualSpent = spending._sum?.amount || 0
        const percentUsed = budget.amount > 0 ? (actualSpent / budget.amount) * 100 : 0
        
        let status: 'under' | 'warning' | 'critical' | 'over' = 'under'
        if (percentUsed >= 100) {
          status = 'over'
        } else if (percentUsed >= budget.criticalThreshold) {
          status = 'critical'
        } else if (percentUsed >= budget.warningThreshold) {
          status = 'warning'
        }

        return {
          ...budget,
          actualSpent,
          remaining: Math.max(0, budget.amount - actualSpent),
          percentUsed: Math.round(percentUsed * 100) / 100,
          status
        }
      })
    )

    // Summary stats
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0)
    const totalSpent = budgetsWithSpending.reduce((sum, b) => sum + b.actualSpent, 0)
    const overBudgetCount = budgetsWithSpending.filter(b => b.status === 'over').length
    const warningCount = budgetsWithSpending.filter(b => b.status === 'warning' || b.status === 'critical').length

    return NextResponse.json({
      budgets: budgetsWithSpending,
      summary: {
        totalBudgeted,
        totalSpent,
        totalRemaining: Math.max(0, totalBudgeted - totalSpent),
        overBudgetCount,
        warningCount,
        totalBudgets: budgets.length
      }
    })
  } catch (error) {
    console.error('Error fetching budgets:', error)
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
  }
}

// POST - Create new budget
export async function POST(request: NextRequest) {
  const adminVerified = await verifyAdmin(request)
  if (!adminVerified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      categoryId,
      name,
      amount,
      period,
      startDate,
      endDate,
      warningThreshold = 80,
      criticalThreshold = 95,
      notes
    } = body

    // Validation
    if (!categoryId || !name || !amount || !period || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: categoryId, name, amount, period, startDate, endDate' },
        { status: 400 }
      )
    }

    // Verify category exists
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId }
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check for overlapping budgets in same category
    const overlapping = await prisma.budget.findFirst({
      where: {
        categoryId,
        OR: [
          {
            AND: [
              { startDate: { lte: new Date(startDate) } },
              { endDate: { gte: new Date(startDate) } }
            ]
          },
          {
            AND: [
              { startDate: { lte: new Date(endDate) } },
              { endDate: { gte: new Date(endDate) } }
            ]
          },
          {
            AND: [
              { startDate: { gte: new Date(startDate) } },
              { endDate: { lte: new Date(endDate) } }
            ]
          }
        ]
      }
    })

    if (overlapping) {
      return NextResponse.json(
        { error: 'A budget already exists for this category during the specified period' },
        { status: 400 }
      )
    }

    const budget = await prisma.budget.create({
      data: {
        categoryId,
        name,
        amount,
        period,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        warningThreshold,
        criticalThreshold,
        notes
      },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true }
        }
      }
    })

    return NextResponse.json({ budget }, { status: 201 })
  } catch (error) {
    console.error('Error creating budget:', error)
    return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 })
  }
}
