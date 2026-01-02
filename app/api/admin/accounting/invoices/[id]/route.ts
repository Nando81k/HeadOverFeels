import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'

// GET - Get single invoice
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
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        expenses: {
          include: {
            category: {
              select: { id: true, name: true, color: true }
            }
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
  }
}

// PATCH - Update invoice
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
      vendorName,
      vendorEmail,
      vendorAddress,
      description,
      subtotal,
      tax,
      issueDate,
      dueDate,
      paidDate,
      status,
      paymentMethod,
      paymentReference,
      documentUrl,
      notes
    } = body

    const updateData: Record<string, unknown> = {}
    
    if (vendorName !== undefined) updateData.vendorName = vendorName
    if (vendorEmail !== undefined) updateData.vendorEmail = vendorEmail
    if (vendorAddress !== undefined) updateData.vendorAddress = vendorAddress
    if (description !== undefined) updateData.description = description
    if (subtotal !== undefined) {
      updateData.subtotal = subtotal
      const taxAmount = tax !== undefined ? tax : (await prisma.invoice.findUnique({ where: { id }, select: { tax: true } }))?.tax || 0
      updateData.total = subtotal + taxAmount
    }
    if (tax !== undefined) {
      updateData.tax = tax
      const currentSubtotal = subtotal !== undefined ? subtotal : (await prisma.invoice.findUnique({ where: { id }, select: { subtotal: true } }))?.subtotal || 0
      updateData.total = currentSubtotal + tax
    }
    if (issueDate !== undefined) updateData.issueDate = new Date(issueDate)
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate)
    if (paidDate !== undefined) updateData.paidDate = paidDate ? new Date(paidDate) : null
    if (status !== undefined) {
      updateData.status = status
      // Auto-set paid date when marking as paid
      if (status === 'PAID' && !paidDate) {
        updateData.paidDate = new Date()
      }
    }
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod
    if (paymentReference !== undefined) updateData.paymentReference = paymentReference
    if (documentUrl !== undefined) updateData.documentUrl = documentUrl
    if (notes !== undefined) updateData.notes = notes

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Error updating invoice:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

// DELETE - Delete invoice
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
    // Check if invoice has linked expenses
    const expenseCount = await prisma.expense.count({
      where: { invoiceId: id }
    })

    if (expenseCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete invoice with linked expenses. Unlink expenses first.' },
        { status: 400 }
      )
    }

    await prisma.invoice.delete({ where: { id } })
    return NextResponse.json({ message: 'Invoice deleted' })
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}
