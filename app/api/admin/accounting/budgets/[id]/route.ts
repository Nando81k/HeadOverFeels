import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'

// GET - Get single budget with spending details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminVerified = await verifyAdmin(request)
  if (!adminVerified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const budget = await prisma.budget.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true }
        }
      }
    })

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    // Get all expenses for this budget period
    const expenses = await prisma.expense.findMany({
      where: {
        categoryId: budget.categoryId ?? undefined,
        date: {
          gte: budget.startDate,
          lte: budget.endDate
        },
        status: { in: ['RECORDED', 'APPROVED', 'PAID'] }
      },
      orderBy: { date: 'desc' }
    })

    const actualSpent = expenses.reduce((sum, e) => sum + e.amount, 0)
    const percentUsed = budget.amount > 0 ? (actualSpent / budget.amount) * 100 : 0
    
    let status: 'under' | 'warning' | 'critical' | 'over' = 'under'
    if (percentUsed >= 100) {
      status = 'over'
    } else if (percentUsed >= budget.criticalThreshold) {
      status = 'critical'
    } else if (percentUsed >= budget.warningThreshold) {
      status = 'warning'
    }

    // Calculate daily average and projected end spending
    const now = new Date()
    const daysPassed = Math.max(1, Math.floor((now.getTime() - budget.startDate.getTime()) / (1000 * 60 * 60 * 24)))
    const totalDays = Math.max(1, Math.floor((budget.endDate.getTime() - budget.startDate.getTime()) / (1000 * 60 * 60 * 24)))
    const dailyAverage = actualSpent / daysPassed
    const projectedTotal = dailyAverage * totalDays

    return NextResponse.json({
      budget: {
        ...budget,
        actualSpent,
        remaining: Math.max(0, budget.amount - actualSpent),
        percentUsed: Math.round(percentUsed * 100) / 100,
        status,
        dailyAverage: Math.round(dailyAverage * 100) / 100,
        projectedTotal: Math.round(projectedTotal * 100) / 100,
        projectedOver: projectedTotal > budget.amount
      },
      expenses,
      expenseCount: expenses.length
    })
  } catch (error) {
    console.error('Error fetching budget:', error)
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 })
  }
}

// PATCH - Update budget
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminVerified = await verifyAdmin(request)
  if (!adminVerified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const {
      name,
      amount,
      period,
      startDate,
      endDate,
      warningThreshold,
      criticalThreshold,
      notes
    } = body

    const updateData: Record<string, unknown> = {}
    
    if (name !== undefined) updateData.name = name
    if (amount !== undefined) updateData.amount = amount
    if (period !== undefined) updateData.period = period
    if (startDate !== undefined) updateData.startDate = new Date(startDate)
    if (endDate !== undefined) updateData.endDate = new Date(endDate)
    if (warningThreshold !== undefined) updateData.warningThreshold = warningThreshold
    if (criticalThreshold !== undefined) updateData.criticalThreshold = criticalThreshold
    if (notes !== undefined) updateData.notes = notes

    const budget = await prisma.budget.update({
      where: { id },
      data: updateData,
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true }
        }
      }
    })

    return NextResponse.json({ budget })
  } catch (error) {
    console.error('Error updating budget:', error)
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 })
  }
}

// DELETE - Delete budget
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminVerified = await verifyAdmin(request)
  if (!adminVerified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    await prisma.budget.delete({ where: { id } })
    return NextResponse.json({ message: 'Budget deleted' })
  } catch (error) {
    console.error('Error deleting budget:', error)
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 })
  }
}
