import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/popups/active - Get active popups for frontend display
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || 'all' // Current page: home, products, cart, etc.
    const isNewVisitor = searchParams.get('new') === 'true'
    
    const now = new Date()
    
    // Fetch active popups matching criteria
    const popups = await prisma.marketingPopup.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: now } }
        ],
        AND: [
          {
            OR: [
              { endDate: null },
              { endDate: { gte: now } }
            ]
          }
        ]
      },
      include: {
        variants: {
          where: { isActive: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })
    
    // Filter by page and visitor type
    const filteredPopups = popups.filter(popup => {
      // Check page targeting
      const showOnPages = popup.showOnPages
      if (showOnPages !== 'all') {
        try {
          const pages = JSON.parse(showOnPages)
          if (Array.isArray(pages) && !pages.includes(page)) {
            return false
          }
        } catch {
          // If not JSON, treat as single page string
          if (showOnPages !== page) {
            return false
          }
        }
      }
      
      // Check visitor targeting
      if (isNewVisitor && !popup.showToNewVisitors) {
        return false
      }
      if (!isNewVisitor && !popup.showToReturning) {
        return false
      }
      
      return true
    })
    
    // Return popups with variants (for A/B testing on frontend)
    const result = filteredPopups.map(popup => {
      // Parse content JSON
      let content = {}
      try {
        content = JSON.parse(popup.content)
      } catch {
        content = { raw: popup.content }
      }
      
      // Parse variant content
      const variants = popup.variants.map(v => {
        let variantContent = null
        if (v.content) {
          try {
            variantContent = JSON.parse(v.content)
          } catch {
            variantContent = { raw: v.content }
          }
        }
        return {
          id: v.id,
          name: v.name,
          content: variantContent,
          weight: v.weight
        }
      })
      
      return {
        id: popup.id,
        name: popup.name,
        template: popup.template,
        position: popup.position,
        content,
        triggerType: popup.triggerType,
        triggerValue: popup.triggerValue,
        frequency: popup.frequency,
        variants: variants.length > 0 ? variants : null
      }
    })
    
    return NextResponse.json({ popups: result })
  } catch (error) {
    console.error('Error fetching active popups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch active popups', popups: [] },
      { status: 500 }
    )
  }
}
