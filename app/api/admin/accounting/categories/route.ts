import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'

// GET - List all expense categories
export async function GET(request: NextRequest) {
  const adminVerified = await verifyAdmin(request)
  if (!adminVerified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const categories = await prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { expenses: true, budgets: true }
        }
      }
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching expense categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

// POST - Create new expense category
export async function POST(request: NextRequest) {
  const adminVerified = await verifyAdmin(request)
  if (!adminVerified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, description, color, icon } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    // Check for duplicate
    const existing = await prisma.expenseCategory.findFirst({
      where: { OR: [{ name }, { slug }] }
    })
    if (existing) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 400 })
    }

    // Get max sort order
    const maxSort = await prisma.expenseCategory.aggregate({
      _max: { sortOrder: true }
    })

    const category = await prisma.expenseCategory.create({
      data: {
        name,
        slug,
        description,
        color: color || '#6B7280',
        icon,
        sortOrder: (maxSort._max.sortOrder || 0) + 1
      }
    })

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error('Error creating expense category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
