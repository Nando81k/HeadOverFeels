import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/promotions/[id] - Get a single promotion
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const promotion = await prisma.promotion.findUnique({
      where: { id }
    })
    
    if (!promotion) {
      return NextResponse.json(
        { error: 'Promotion not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ data: promotion })
  } catch (error) {
    console.error('Error fetching promotion:', error)
    return NextResponse.json(
      { error: 'Failed to fetch promotion' },
      { status: 500 }
    )
  }
}

// PUT /api/promotions/[id] - Update a promotion
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const {
      name,
      description,
      type,
      value,
      code,
      autoApply,
      minimumPurchase,
      maxUsesTotal,
      maxUsesPerCustomer,
      productIds,
      collectionIds,
      customerEmails,
      startDate,
      endDate,
      isActive
    } = body
    
    // Check if promotion exists
    const existing = await prisma.promotion.findUnique({
      where: { id }
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Promotion not found' },
        { status: 404 }
      )
    }
    
    // Check for duplicate code (if changing)
    if (code && code.toUpperCase() !== existing.code) {
      const duplicateCode = await prisma.promotion.findUnique({
        where: { code: code.toUpperCase() }
      })
      if (duplicateCode) {
        return NextResponse.json(
          { error: 'A promotion with this code already exists' },
          { status: 400 }
        )
      }
    }
    
    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(type !== undefined && { type }),
        ...(value !== undefined && { value: parseFloat(value) }),
        ...(code !== undefined && { code: code ? code.toUpperCase() : null }),
        ...(autoApply !== undefined && { autoApply }),
        ...(minimumPurchase !== undefined && { minimumPurchase: minimumPurchase ? parseFloat(minimumPurchase) : null }),
        ...(maxUsesTotal !== undefined && { maxUsesTotal: maxUsesTotal ? parseInt(maxUsesTotal) : null }),
        ...(maxUsesPerCustomer !== undefined && { maxUsesPerCustomer: maxUsesPerCustomer ? parseInt(maxUsesPerCustomer) : null }),
        ...(productIds !== undefined && { productIds: productIds ? JSON.stringify(productIds) : null }),
        ...(collectionIds !== undefined && { collectionIds: collectionIds ? JSON.stringify(collectionIds) : null }),
        ...(customerEmails !== undefined && { customerEmails: customerEmails ? JSON.stringify(customerEmails) : null }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : new Date() }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isActive !== undefined && { isActive })
      }
    })
    
    return NextResponse.json({ data: promotion })
  } catch (error) {
    console.error('Error updating promotion:', error)
    return NextResponse.json(
      { error: 'Failed to update promotion' },
      { status: 500 }
    )
  }
}

// DELETE /api/promotions/[id] - Delete a promotion
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    await prisma.promotion.delete({
      where: { id }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting promotion:', error)
    return NextResponse.json(
      { error: 'Failed to delete promotion' },
      { status: 500 }
    )
  }
}
