import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { DropEarlyAccess, LoyaltyTier } from '@prisma/client'

type EarlyAccessConfigWithTier = DropEarlyAccess & {
  loyaltyTier: Pick<LoyaltyTier, 'id' | 'name' | 'slug'> | null
}

// GET - List all early access configurations for a product
export async function GET(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    
    const configs = await prisma.dropEarlyAccess.findMany({
      where: productId ? { productId } : {},
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            releaseDate: true,
            dropEndDate: true
          }
        },
        loyaltyTier: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: [
        { productId: 'asc' },
        { startDate: 'asc' }
      ]
    })
    
    return NextResponse.json({ configs })
    
  } catch (error) {
    console.error('Error fetching early access configs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create or update early access configuration
export async function POST(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get admin for audit log
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId }
    })
    
    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 403 })
    }
    
    const body = await request.json()
    const { 
      productId,
      configs // Array of { loyaltyTierId, startDate, endDate, pointsCost, isActive }
    } = body
    
    if (!productId || !configs || !Array.isArray(configs)) {
      return NextResponse.json({ 
        error: 'Product ID and configs array required' 
      }, { status: 400 })
    }
    
    // Validate product exists and is a limited edition
    const product = await prisma.product.findUnique({
      where: { id: productId }
    })
    
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    
    if (!product.isLimitedEdition) {
      return NextResponse.json({ 
        error: 'Product must be a limited edition drop' 
      }, { status: 400 })
    }
    
    // Delete existing configs for this product
    await prisma.dropEarlyAccess.deleteMany({
      where: { productId }
    })
    
    // Create new configs
    const createdConfigs: EarlyAccessConfigWithTier[] = await Promise.all(
      configs.map(async (config: {
        loyaltyTierId?: string | null
        startDate: string
        endDate: string
        pointsCost?: number
        isActive?: boolean
      }) => {
        // Validate tier exists if provided
        if (config.loyaltyTierId) {
          const tier = await prisma.loyaltyTier.findUnique({
            where: { id: config.loyaltyTierId }
          })
          if (!tier) {
            throw new Error(`Invalid loyalty tier: ${config.loyaltyTierId}`)
          }
        }
        
        return prisma.dropEarlyAccess.create({
          data: {
            productId,
            loyaltyTierId: config.loyaltyTierId || null,
            startDate: new Date(config.startDate),
            endDate: new Date(config.endDate),
            pointsCost: config.pointsCost ?? 500,
            isActive: config.isActive ?? true
          },
          include: {
            loyaltyTier: {
              select: { id: true, name: true, slug: true }
            }
          }
        })
      })
    )
    
    // Create audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: 'UPDATE',
        category: 'PRODUCT',
        targetId: productId,
        targetType: 'DropEarlyAccess',
        targetLabel: product.name,
        description: `Updated early access configuration for ${product.name}`,
        changes: JSON.stringify({
          configCount: createdConfigs.length,
          configs: createdConfigs.map((c: EarlyAccessConfigWithTier) => ({
            tier: c.loyaltyTier?.name || 'All qualifying tiers',
            startDate: c.startDate,
            endDate: c.endDate,
            pointsCost: c.pointsCost
          }))
        })
      }
    })
    
    return NextResponse.json({ 
      success: true,
      configs: createdConfigs 
    })
    
  } catch (error) {
    console.error('Error saving early access config:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}

// DELETE - Remove all early access configs for a product
export async function DELETE(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get admin for audit log
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId }
    })
    
    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 403 })
    }
    
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    
    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    }
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true }
    })
    
    await prisma.dropEarlyAccess.deleteMany({
      where: { productId }
    })
    
    // Create audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: 'DELETE',
        category: 'PRODUCT',
        targetId: productId,
        targetType: 'DropEarlyAccess',
        targetLabel: product?.name || productId,
        description: `Removed all early access configurations for ${product?.name || productId}`
      }
    })
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Error deleting early access config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
