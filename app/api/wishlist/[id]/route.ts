import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE /api/wishlist/[id] - Remove item from wishlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if wishlist item exists
    const existingItem = await prisma.wishlistItem.findUnique({
      where: { id }
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Wishlist item not found' },
        { status: 404 }
      )
    }

    // Delete wishlist item
    await prisma.wishlistItem.delete({
      where: { id }
    })

    return NextResponse.json({
      message: 'Item removed from wishlist'
    })

  } catch (error) {
    console.error('Error removing from wishlist:', error)
    return NextResponse.json(
      { error: 'Failed to remove item from wishlist' },
      { status: 500 }
    )
  }
}

// PATCH /api/wishlist/[id] - Update wishlist item (notes, priority)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { notes, priority } = body

    // Check if wishlist item exists
    const existingItem = await prisma.wishlistItem.findUnique({
      where: { id }
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Wishlist item not found' },
        { status: 404 }
      )
    }

    // Update wishlist item
    const updateData: Record<string, unknown> = {}
    if (notes !== undefined) {
      updateData.notes = notes || null
    }
    if (priority !== undefined) {
      updateData.priority = priority
    }

    const wishlistItem = await prisma.wishlistItem.update({
      where: { id },
      data: updateData,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            images: true
          }
        },
        productVariant: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            price: true
          }
        }
      }
    })

    return NextResponse.json({
      data: wishlistItem,
      message: 'Wishlist item updated'
    })

  } catch (error) {
    console.error('Error updating wishlist item:', error)
    return NextResponse.json(
      { error: 'Failed to update wishlist item' },
      { status: 500 }
    )
  }
}
