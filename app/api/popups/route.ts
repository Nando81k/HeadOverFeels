import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// GET /api/popups - List all popups (admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('active')
    const includeVariants = searchParams.get('includeVariants') === 'true'
    
    const where: Prisma.MarketingPopupWhereInput = {}
    
    if (isActive === 'true') {
      where.isActive = true
    } else if (isActive === 'false') {
      where.isActive = false
    }
    
    const popups = await prisma.marketingPopup.findMany({
      where,
      include: {
        variants: includeVariants,
        _count: {
          select: {
            variants: true,
            analytics: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })
    
    // Calculate aggregate analytics for each popup
    const popupsWithStats = await Promise.all(
      popups.map(async (popup) => {
        const stats = await prisma.popupAnalytics.aggregate({
          where: { popupId: popup.id },
          _sum: {
            impressions: true,
            clicks: true,
            dismissals: true,
            conversions: true
          }
        })
        
        return {
          ...popup,
          stats: {
            impressions: stats._sum.impressions || 0,
            clicks: stats._sum.clicks || 0,
            dismissals: stats._sum.dismissals || 0,
            conversions: stats._sum.conversions || 0,
            ctr: stats._sum.impressions 
              ? ((stats._sum.clicks || 0) / stats._sum.impressions * 100).toFixed(1)
              : '0.0'
          }
        }
      })
    )
    
    return NextResponse.json({ data: popupsWithStats })
  } catch (error) {
    console.error('Error fetching popups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch popups' },
      { status: 500 }
    )
  }
}

// POST /api/popups - Create a new popup
export async function POST(request: NextRequest) {
  try {
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
      targetNewVisitors,
      targetReturning,
      frequency,
      startDate,
      endDate,
      isActive,
      priority,
      variants
    } = body
    
    // Validate required fields - content can come from variants
    const hasContent = content || (variants && variants.length > 0 && variants[0]?.content)
    if (!name || !hasContent) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      )
    }
    
    // Get content from variants if not provided directly
    const popupContent = content || (variants?.[0]?.content)
    
    // Create popup with variants if provided
    const popup = await prisma.marketingPopup.create({
      data: {
        name,
        template: template || 'MODAL',
        position: position || 'CENTER',
        content: typeof popupContent === 'string' ? popupContent : JSON.stringify(popupContent),
        triggerType: triggerType || 'DELAY',
        triggerValue: triggerValue ?? 3,
        showOnPages: showOnPages || 'all',
        showToNewVisitors: showToNewVisitors ?? targetNewVisitors ?? true,
        showToReturning: showToReturning ?? targetReturning ?? true,
        frequency: frequency || 'ONCE_PER_SESSION',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive ?? true,
        priority: priority ?? 0,
        variants: variants?.length > 0 ? {
          create: variants.map((v: { name: string; content?: unknown; weight?: number }) => ({
            name: v.name,
            content: v.content ? (typeof v.content === 'string' ? v.content : JSON.stringify(v.content)) : null,
            weight: v.weight ?? 50
          }))
        } : undefined
      },
      include: {
        variants: true
      }
    })
    
    return NextResponse.json({ data: popup }, { status: 201 })
  } catch (error) {
    console.error('Error creating popup:', error)
    // Return more detailed error info in development
    const errorMessage = error instanceof Error ? error.message : 'Failed to create popup'
    return NextResponse.json(
      { error: errorMessage, details: String(error) },
      { status: 500 }
    )
  }
}
