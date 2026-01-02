import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'

// GET - Financial summary with P&L, tax overview, and key metrics
export async function GET(request: NextRequest) {
  const adminVerified = await verifyAdmin(request)
  if (!adminVerified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const periodParam = searchParams.get('period') || 'month' // day, week, month, quarter, year
  const customStartDate = searchParams.get('startDate')
  const customEndDate = searchParams.get('endDate')

  try {
    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    let endDate: Date = now
    let previousStartDate: Date
    let previousEndDate: Date

    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate)
      endDate = new Date(customEndDate)
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      previousEndDate = new Date(startDate)
      previousEndDate.setDate(previousEndDate.getDate() - 1)
      previousStartDate = new Date(previousEndDate)
      previousStartDate.setDate(previousStartDate.getDate() - daysDiff)
    } else {
      switch (periodParam) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          previousStartDate = new Date(startDate)
          previousStartDate.setDate(previousStartDate.getDate() - 1)
          previousEndDate = new Date(startDate)
          previousEndDate.setMilliseconds(-1)
          break
        case 'week':
          const dayOfWeek = now.getDay()
          startDate = new Date(now)
          startDate.setDate(now.getDate() - dayOfWeek)
          startDate.setHours(0, 0, 0, 0)
          previousStartDate = new Date(startDate)
          previousStartDate.setDate(previousStartDate.getDate() - 7)
          previousEndDate = new Date(startDate)
          previousEndDate.setMilliseconds(-1)
          break
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3)
          startDate = new Date(now.getFullYear(), quarter * 3, 1)
          previousStartDate = new Date(now.getFullYear(), (quarter - 1) * 3, 1)
          previousEndDate = new Date(startDate)
          previousEndDate.setMilliseconds(-1)
          break
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1)
          previousStartDate = new Date(now.getFullYear() - 1, 0, 1)
          previousEndDate = new Date(now.getFullYear(), 0, 0)
          break
        case 'month':
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0)
          break
      }
    }

    // REVENUE: Get sales data from orders
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }
      },
      select: { total: true }
    })
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0)

    // Previous period revenue
    const previousOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: previousStartDate, lte: previousEndDate },
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }
      },
      select: { total: true }
    })
    const previousRevenue = previousOrders.reduce((sum, o) => sum + o.total, 0)

    // EXPENSES: Get all expenses for period
    const expenses = await prisma.expense.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        status: { in: ['RECORDED', 'APPROVED', 'PAID'] }
      },
      include: {
        category: { select: { name: true, color: true } }
      }
    })
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

    // Previous period expenses
    const previousExpenses = await prisma.expense.findMany({
      where: {
        date: { gte: previousStartDate, lte: previousEndDate },
        status: { in: ['RECORDED', 'APPROVED', 'PAID'] }
      },
      select: { amount: true }
    })
    const previousTotalExpenses = previousExpenses.reduce((sum, e) => sum + e.amount, 0)

    // TAX-DEDUCTIBLE expenses
    const taxDeductibleExpenses = expenses
      .filter(e => e.isTaxDeductible)
      .reduce((sum, e) => sum + e.amount, 0)

    // Expenses by category
    const expensesByCategory = expenses.reduce((acc, expense) => {
      const categoryName = expense.category?.name || 'Uncategorized'
      if (!acc[categoryName]) {
        acc[categoryName] = {
          name: categoryName,
          color: expense.category?.color || '#6b7280',
          amount: 0,
          count: 0
        }
      }
      acc[categoryName].amount += expense.amount
      acc[categoryName].count += 1
      return acc
    }, {} as Record<string, { name: string; color: string; amount: number; count: number }>)

    // PROFIT & LOSS
    const netProfit = totalRevenue - totalExpenses
    const previousNetProfit = previousRevenue - previousTotalExpenses
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    const previousProfitMargin = previousRevenue > 0 ? (previousNetProfit / previousRevenue) * 100 : 0

    // Calculate changes
    const revenueChange = previousRevenue > 0 
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
      : (totalRevenue > 0 ? 100 : 0)
    const expenseChange = previousTotalExpenses > 0 
      ? ((totalExpenses - previousTotalExpenses) / previousTotalExpenses) * 100 
      : (totalExpenses > 0 ? 100 : 0)
    const profitChange = previousNetProfit !== 0 
      ? ((netProfit - previousNetProfit) / Math.abs(previousNetProfit)) * 100 
      : (netProfit > 0 ? 100 : (netProfit < 0 ? -100 : 0))

    // INVOICES summary
    const pendingInvoices = await prisma.invoice.aggregate({
      where: { status: 'PENDING' },
      _sum: { total: true },
      _count: true
    })

    const overdueInvoices = await prisma.invoice.aggregate({
      where: { 
        status: 'PENDING',
        dueDate: { lt: now }
      },
      _sum: { total: true },
      _count: true
    })

    // BUDGETS health
    const activeBudgets = await prisma.budget.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now }
      },
      include: {
        category: { select: { id: true, name: true } }
      }
    })

    const budgetHealth = await Promise.all(
      activeBudgets.map(async (budget) => {
        const spent = await prisma.expense.aggregate({
          where: {
            categoryId: budget.categoryId ?? undefined,
            date: { gte: budget.startDate, lte: budget.endDate },
            status: { in: ['RECORDED', 'APPROVED', 'PAID'] }
          },
          _sum: { amount: true }
        })
        const actualSpent = spent._sum?.amount || 0
        const percentUsed = budget.amount > 0 ? (actualSpent / budget.amount) * 100 : 0
        return {
          id: budget.id,
          name: budget.name,
          categoryName: budget.category?.name ?? 'Uncategorized',
          budgeted: budget.amount,
          spent: actualSpent,
          percentUsed: Math.round(percentUsed * 100) / 100,
          isOverBudget: percentUsed >= 100,
          isWarning: percentUsed >= budget.warningThreshold && percentUsed < 100
        }
      })
    )

    // Order count for the period
    const orderCount = orders.length
    const previousOrderCount = previousOrders.length
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0
    const previousAvgOrderValue = previousOrderCount > 0 ? previousRevenue / previousOrderCount : 0

    return NextResponse.json({
      period: {
        label: periodParam,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      profitAndLoss: {
        revenue: {
          current: totalRevenue,
          previous: previousRevenue,
          changePercent: Math.round(revenueChange * 100) / 100
        },
        expenses: {
          current: totalExpenses,
          previous: previousTotalExpenses,
          changePercent: Math.round(expenseChange * 100) / 100
        },
        netProfit: {
          current: netProfit,
          previous: previousNetProfit,
          changePercent: Math.round(profitChange * 100) / 100
        },
        profitMargin: {
          current: Math.round(profitMargin * 100) / 100,
          previous: Math.round(previousProfitMargin * 100) / 100
        }
      },
      orders: {
        count: orderCount,
        previousCount: previousOrderCount,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        previousAvgOrderValue: Math.round(previousAvgOrderValue * 100) / 100
      },
      expenseBreakdown: Object.values(expensesByCategory).sort((a, b) => b.amount - a.amount),
      tax: {
        deductibleExpenses: taxDeductibleExpenses,
        nonDeductibleExpenses: totalExpenses - taxDeductibleExpenses,
        estimatedTaxSavings: taxDeductibleExpenses * 0.25 // Rough estimate at 25% tax rate
      },
      invoices: {
        pendingCount: pendingInvoices._count,
        pendingAmount: pendingInvoices._sum.total || 0,
        overdueCount: overdueInvoices._count,
        overdueAmount: overdueInvoices._sum.total || 0
      },
      budgetHealth: {
        activeBudgets: budgetHealth.length,
        overBudgetCount: budgetHealth.filter(b => b.isOverBudget).length,
        warningCount: budgetHealth.filter(b => b.isWarning).length,
        budgets: budgetHealth
      }
    })
  } catch (error) {
    console.error('Error fetching financial summary:', error)
    return NextResponse.json({ error: 'Failed to fetch financial summary' }, { status: 500 })
  }
}
