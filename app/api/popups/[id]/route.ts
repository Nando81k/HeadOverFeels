import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/popups/[id] - Get a single popup with variants and analytics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const popup = await prisma.marketingPopup.findUnique({
      where: { id },
      include: {
        variants: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })
    
    if (!popup) {
      return NextResponse.json(
        { error: 'Popup not found' },
        { status: 404 }
      )
    }
    
    // Get aggregate analytics
    const stats = await prisma.popupAnalytics.aggregate({
      where: { popupId: id },
      _sum: {
        impressions: true,
        clicks: true,
        dismissals: true,
        conversions: true
      }
    })
    
    // Get variant-level analytics
    const variantStats = await Promise.all(
      popup.variants.map(async (variant) => {
        const vStats = await prisma.popupAnalytics.aggregate({
          where: { variantId: variant.id },
          _sum: {
            impressions: true,
            clicks: true,
            dismissals: true,
            conversions: true
          }
        })
        return {
          variantId: variant.id,
          impressions: vStats._sum.impressions || 0,
          clicks: vStats._sum.clicks || 0,
          dismissals: vStats._sum.dismissals || 0,
          conversions: vStats._sum.conversions || 0
        }
      })
    )
    
    return NextResponse.json({
      data: {
        ...popup,
        stats: {
          impressions: stats._sum.impressions || 0,
          clicks: stats._sum.clicks || 0,
          dismissals: stats._sum.dismissals || 0,
          conversions: stats._sum.conversions || 0,
          ctr: stats._sum.impressions 
            ? ((stats._sum.clicks || 0) / stats._sum.impressions * 100).toFixed(1)
            : '0.0'
        },
        variantStats
      }
    })
  } catch (error) {
    console.error('Error fetching popup:', error)
    return NextResponse.json(
      { error: 'Failed to fetch popup' },
      { status: 500 }
    )
  }
}

// PUT /api/popups/[id] - Update a popup
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const {
      name,
      template,
      position,
      content,
      triggerType,
      triggerValue,
      showOnPages,
      showToNewVisitors,
      showToReturning,
      frequency,
      startDate,
      endDate,
      isActive,
      priority,
      variants
    } = body
    
    // Check if popup exists
    const existing = await prisma.marketingPopup.findUnique({
      where: { id },
      include: { variants: true }
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Popup not found' },
        { status: 404 }
      )
    }
    
    // Update popup
    const popup = await prisma.marketingPopup.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(template !== undefined && { template }),
        ...(position !== undefined && { position }),
        ...(content !== undefined && { content: typeof content === 'string' ? content : JSON.stringify(content) }),
        ...(triggerType !== undefined && { triggerType }),
        ...(triggerValue !== undefined && { triggerValue }),
        ...(showOnPages !== undefined && { showOnPages }),
        ...(showToNewVisitors !== undefined && { showToNewVisitors }),
        ...(showToReturning !== undefined && { showToReturning }),
        ...(frequency !== undefined && { frequency }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isActive !== undefined && { isActive }),
        ...(priority !== undefined && { priority })
      },
      include: {
        variants: true
      }
    })
    
    // Handle variants update if provided
    if (variants !== undefined) {
      // Delete removed variants
      const variantIds = variants.filter((v: { id?: string }) => v.id).map((v: { id: string }) => v.id)
      await prisma.popupVariant.deleteMany({
        where: {
          popupId: id,
          id: { notIn: variantIds }
        }
      })
      
      // Upsert variants
      for (const variant of variants) {
        if (variant.id) {
          await prisma.popupVariant.update({
            where: { id: variant.id },
            data: {
              name: variant.name,
              content: variant.content ? (typeof variant.content === 'string' ? variant.content : JSON.stringify(variant.content)) : null,
              weight: variant.weight ?? 50,
              isActive: variant.isActive ?? true
            }
          })
        } else {
          await prisma.popupVariant.create({
            data: {
              popupId: id,
              name: variant.name,
              content: variant.content ? (typeof variant.content === 'string' ? variant.content : JSON.stringify(variant.content)) : null,
              weight: variant.weight ?? 50
            }
          })
        }
      }
    }
    
    // Fetch updated popup with variants
    const updatedPopup = await prisma.marketingPopup.findUnique({
      where: { id },
      include: { variants: true }
    })
    
    return NextResponse.json({ data: updatedPopup })
  } catch (error) {
    console.error('Error updating popup:', error)
    return NextResponse.json(
      { error: 'Failed to update popup' },
      { status: 500 }
    )
  }
}

// DELETE /api/popups/[id] - Delete a popup
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    await prisma.marketingPopup.delete({
      where: { id }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting popup:', error)
    return NextResponse.json(
      { error: 'Failed to delete popup' },
      { status: 500 }
    )
  }
}
