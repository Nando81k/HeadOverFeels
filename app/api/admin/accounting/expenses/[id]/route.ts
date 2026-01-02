import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'

// GET - Get single expense
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
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        category: true,
        invoice: true
      }
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json({ expense })
  } catch (error) {
    console.error('Error fetching expense:', error)
    return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 })
  }
}

// PATCH - Update expense
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
      status,
      invoiceId
    } = body

    const updateData: Record<string, unknown> = {}
    
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (description !== undefined) updateData.description = description
    if (amount !== undefined) updateData.amount = amount
    if (date !== undefined) updateData.date = new Date(date)
    if (vendor !== undefined) updateData.vendor = vendor
    if (receiptUrl !== undefined) updateData.receiptUrl = receiptUrl
    if (notes !== undefined) updateData.notes = notes
    if (isTaxDeductible !== undefined) updateData.isTaxDeductible = isTaxDeductible
    if (taxCategory !== undefined) updateData.taxCategory = taxCategory
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring
    if (recurringFrequency !== undefined) updateData.recurringFrequency = recurringFrequency
    if (status !== undefined) updateData.status = status
    if (invoiceId !== undefined) updateData.invoiceId = invoiceId

    const expense = await prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true }
        }
      }
    })

    return NextResponse.json({ expense })
  } catch (error) {
    console.error('Error updating expense:', error)
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
  }
}

// DELETE - Delete expense
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
    await prisma.expense.delete({ where: { id } })
    return NextResponse.json({ message: 'Expense deleted' })
  } catch (error) {
    console.error('Error deleting expense:', error)
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}
