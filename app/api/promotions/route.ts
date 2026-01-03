import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// GET /api/promotions - List all promotions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('active')
    const includeExpired = searchParams.get('includeExpired') === 'true'
    
    const where: Prisma.PromotionWhereInput = {}
    
    if (isActive === 'true') {
      const now = new Date()
      where.isActive = true
      where.startDate = { lte: now }
      where.OR = [
        { endDate: null },
        { endDate: { gte: now } }
      ]
    } else if (isActive === 'false') {
      where.isActive = false
    }
    
    if (!includeExpired) {
      const now = new Date()
      where.OR = [
        { endDate: null },
        { endDate: { gte: now } }
      ]
    }
    
    const promotions = await prisma.promotion.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({ data: promotions })
  } catch (error) {
    console.error('Error fetching promotions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch promotions' },
      { status: 500 }
    )
  }
}

// POST /api/promotions - Create a new promotion
export async function POST(request: NextRequest) {
  try {
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
    
    // Validate required fields
    if (!name || !type || value === undefined) {
      return NextResponse.json(
        { error: 'Name, type, and value are required' },
        { status: 400 }
      )
    }
    
    // Check for duplicate code
    if (code) {
      const existing = await prisma.promotion.findUnique({
        where: { code: code.toUpperCase() }
      })
      if (existing) {
        return NextResponse.json(
          { error: 'A promotion with this code already exists' },
          { status: 400 }
        )
      }
    }
    
    const promotion = await prisma.promotion.create({
      data: {
        name,
        description,
        type,
        value: parseFloat(value),
        code: code ? code.toUpperCase() : null,
        autoApply: autoApply ?? false,
        minimumPurchase: minimumPurchase ? parseFloat(minimumPurchase) : null,
        maxUsesTotal: maxUsesTotal ? parseInt(maxUsesTotal) : null,
        maxUsesPerCustomer: maxUsesPerCustomer ? parseInt(maxUsesPerCustomer) : null,
        productIds: productIds ? JSON.stringify(productIds) : null,
        collectionIds: collectionIds ? JSON.stringify(collectionIds) : null,
        customerEmails: customerEmails ? JSON.stringify(customerEmails) : null,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive ?? true
      }
    })
    
    return NextResponse.json({ data: promotion }, { status: 201 })
  } catch (error) {
    console.error('Error creating promotion:', error)
    return NextResponse.json(
      { error: 'Failed to create promotion' },
      { status: 500 }
    )
  }
}
