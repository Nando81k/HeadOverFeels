import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface TrackRequest {
  popupId: string
  variantId?: string
  event: 'impression' | 'click' | 'dismiss' | 'conversion'
}

// POST /api/popups/track - Track popup analytics
export async function POST(request: NextRequest) {
  try {
    const body: TrackRequest = await request.json()
    const { popupId, variantId, event } = body
    
    if (!popupId || !event) {
      return NextResponse.json(
        { error: 'popupId and event are required' },
        { status: 400 }
      )
    }
    
    // Get today's date at midnight for aggregation
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Find or create analytics record for today
    const existingRecord = await prisma.popupAnalytics.findFirst({
      where: {
        popupId,
        variantId: variantId || null,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    })
    
    if (existingRecord) {
      // Update existing record
      const updateData: Record<string, { increment: number }> = {}
      
      switch (event) {
        case 'impression':
          updateData.impressions = { increment: 1 }
          break
        case 'click':
          updateData.clicks = { increment: 1 }
          break
        case 'dismiss':
          updateData.dismissals = { increment: 1 }
          break
        case 'conversion':
          updateData.conversions = { increment: 1 }
          break
      }
      
      await prisma.popupAnalytics.update({
        where: { id: existingRecord.id },
        data: updateData
      })
    } else {
      // Create new record
      const data: {
        popupId: string
        variantId?: string
        date: Date
        impressions: number
        clicks: number
        dismissals: number
        conversions: number
      } = {
        popupId,
        date: today,
        impressions: 0,
        clicks: 0,
        dismissals: 0,
        conversions: 0
      }
      
      if (variantId) {
        data.variantId = variantId
      }
      
      switch (event) {
        case 'impression':
          data.impressions = 1
          break
        case 'click':
          data.clicks = 1
          break
        case 'dismiss':
          data.dismissals = 1
          break
        case 'conversion':
          data.conversions = 1
          break
      }
      
      await prisma.popupAnalytics.create({ data })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking popup event:', error)
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    )
  }
}
