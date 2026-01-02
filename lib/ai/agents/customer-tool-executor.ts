import { prisma } from '@/lib/prisma'
import { SupportTicketType, SupportPriority } from '@prisma/client'

/**
 * Execute customer-facing tools
 * These tools call the actual APIs/database to perform actions
 */

interface ToolContext {
  customerId?: string
  customerEmail?: string
}

export async function executeCustomerTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> {
  switch (toolName) {
    case 'searchProducts':
      return searchProducts(args)
    case 'getProductDetails':
      return getProductDetails(args)
    case 'getRecommendations':
      return getRecommendations(args, context)
    case 'getLimitedDrops':
      return getLimitedDrops(args)
    case 'checkProductAvailability':
      return checkProductAvailability(args)
    case 'getOrderStatus':
      return getOrderStatus(args, context)
    case 'getOrderHistory':
      return getOrderHistory(context)
    case 'addToCart':
      return addToCart(args)
    case 'getCartSummary':
      return getCartSummary(context)
    case 'applyCoupon':
      return applyCoupon(args)
    case 'createSupportTicket':
      return createSupportTicket(args, context)
    case 'getTicketStatus':
      return getTicketStatus(args, context)
    case 'requestLiveAgent':
      return requestLiveAgent(args, context)
    case 'getLoyaltyStatus':
      return getLoyaltyStatus(context)
    case 'getAvailableRewards':
      return getAvailableRewards()
    case 'getReferralCode':
      return getReferralCode(context)
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

// ===== SHOPPING TOOLS =====

async function searchProducts(args: Record<string, unknown>) {
  const { query, category, minPrice, maxPrice, isLimitedEdition, limit = 5 } = args

  const where: Record<string, unknown> = { isActive: true }
  
  if (query) {
    where.OR = [
      { name: { contains: query as string } },
      { description: { contains: query as string } },
    ]
  }
  if (category) {
    where.category = { slug: category as string }
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {}
    if (minPrice !== undefined) (where.price as Record<string, unknown>).gte = minPrice
    if (maxPrice !== undefined) (where.price as Record<string, unknown>).lte = maxPrice
  }
  if (isLimitedEdition !== undefined) {
    where.isLimitedEdition = isLimitedEdition
  }

  const products = await prisma.product.findMany({
    where,
    take: limit as number,
    include: {
      category: true,
      variants: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    success: true,
    count: products.length,
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      image: JSON.parse(p.images || '[]')[0],
      category: p.category?.name,
      isLimitedEdition: p.isLimitedEdition,
      inStock: p.variants.some(v => v.inventory > 0),
      variants: p.variants.map(v => ({
        id: v.id,
        size: v.size,
        color: v.color,
        inventory: v.inventory,
      })),
    })),
  }
}

async function getProductDetails(args: Record<string, unknown>) {
  const { productId, productSlug } = args

  const product = await prisma.product.findFirst({
    where: productId ? { id: productId as string } : { slug: productSlug as string },
    include: {
      category: true,
      variants: true,
      reviews: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } } },
      },
    },
  })

  if (!product) {
    return { error: 'Product not found' }
  }

  const avgRating = product.reviews.length > 0
    ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
    : null

  return {
    success: true,
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      images: JSON.parse(product.images || '[]'),
      category: product.category?.name,
      materials: product.materials,
      careGuide: product.careGuide,
      isLimitedEdition: product.isLimitedEdition,
      releaseDate: product.releaseDate,
      dropEndDate: product.dropEndDate,
      variants: product.variants.map(v => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        inventory: v.inventory,
        inStock: v.inventory > 0,
      })),
      rating: avgRating,
      reviewCount: product.reviews.length,
      recentReviews: product.reviews.map(r => ({
        rating: r.rating,
        comment: r.comment,
        author: r.customer?.name || 'Anonymous',
        date: r.createdAt,
      })),
    },
  }
}

async function getRecommendations(args: Record<string, unknown>, context: ToolContext) {
  const { type, productId, limit = 4 } = args

  switch (type) {
    case 'trending': {
      const products = await prisma.product.findMany({
        where: { isActive: true, isFeatured: true },
        take: limit as number,
        include: { variants: true },
      })
      return {
        success: true,
        type: 'trending',
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          image: JSON.parse(p.images || '[]')[0],
        })),
      }
    }
    case 'personalized': {
      // Get products based on customer's view history
      if (!context.customerId) {
        // Fall back to featured products for guests
        const products = await prisma.product.findMany({
          where: { isActive: true, isFeaturedNewArrival: true },
          take: limit as number,
        })
        return {
          success: true,
          type: 'new_arrivals',
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            image: JSON.parse(p.images || '[]')[0],
          })),
        }
      }
      // Get viewed products and recommend similar
      const views = await prisma.productView.findMany({
        where: { customerId: context.customerId },
        orderBy: { viewedAt: 'desc' },
        take: 5,
        include: { product: { include: { category: true } } },
      })
      const categoryIds = [...new Set(views.map(v => v.product.categoryId).filter(Boolean))]
      const products = await prisma.product.findMany({
        where: {
          isActive: true,
          categoryId: { in: categoryIds as string[] },
          id: { notIn: views.map(v => v.productId) },
        },
        take: limit as number,
      })
      return {
        success: true,
        type: 'personalized',
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          image: JSON.parse(p.images || '[]')[0],
        })),
      }
    }
    case 'similar': {
      if (!productId) return { error: 'Product ID required for similar recommendations' }
      const product = await prisma.product.findUnique({
        where: { id: productId as string },
        include: { category: true },
      })
      if (!product) return { error: 'Product not found' }
      const similar = await prisma.product.findMany({
        where: {
          isActive: true,
          categoryId: product.categoryId,
          id: { not: product.id },
        },
        take: limit as number,
      })
      return {
        success: true,
        type: 'similar',
        products: similar.map(p => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          image: JSON.parse(p.images || '[]')[0],
        })),
      }
    }
    default:
      return { error: `Unknown recommendation type: ${type}` }
  }
}

async function getLimitedDrops(args: Record<string, unknown>) {
  const { status = 'all' } = args
  const now = new Date()

  let where: Record<string, unknown> = { isLimitedEdition: true, isActive: true }

  if (status === 'live') {
    where.releaseDate = { lte: now }
    where.dropEndDate = { gte: now }
  } else if (status === 'upcoming') {
    where.releaseDate = { gt: now }
  } else if (status === 'past') {
    where.dropEndDate = { lt: now }
  }

  const drops = await prisma.product.findMany({
    where,
    include: { variants: true },
    orderBy: { releaseDate: 'asc' },
  })

  return {
    success: true,
    drops: drops.map(d => {
      const totalStock = d.variants.reduce((sum, v) => sum + v.inventory, 0)
      const maxQty = d.maxQuantity || totalStock
      const soldOut = totalStock === 0

      let dropStatus: 'live' | 'upcoming' | 'past' | 'sold_out' = 'upcoming'
      if (soldOut) dropStatus = 'sold_out'
      else if (d.releaseDate && d.releaseDate <= now && (!d.dropEndDate || d.dropEndDate >= now)) dropStatus = 'live'
      else if (d.dropEndDate && d.dropEndDate < now) dropStatus = 'past'

      return {
        id: d.id,
        name: d.name,
        slug: d.slug,
        price: d.price,
        image: JSON.parse(d.images || '[]')[0],
        status: dropStatus,
        releaseDate: d.releaseDate,
        dropEndDate: d.dropEndDate,
        stockRemaining: totalStock,
        maxQuantity: maxQty,
        percentSold: maxQty > 0 ? Math.round(((maxQty - totalStock) / maxQty) * 100) : 0,
      }
    }),
  }
}

async function checkProductAvailability(args: Record<string, unknown>) {
  const { productId, size, color } = args

  const product = await prisma.product.findUnique({
    where: { id: productId as string },
    include: { variants: true },
  })

  if (!product) return { error: 'Product not found' }

  let variants = product.variants
  if (size) variants = variants.filter(v => v.size?.toLowerCase() === (size as string).toLowerCase())
  if (color) variants = variants.filter(v => v.color?.toLowerCase() === (color as string).toLowerCase())

  return {
    success: true,
    productName: product.name,
    availability: variants.map(v => ({
      variantId: v.id,
      size: v.size,
      color: v.color,
      inStock: v.inventory > 0,
      quantity: v.inventory,
      lowStock: v.inventory > 0 && v.inventory < 5,
    })),
    anyInStock: variants.some(v => v.inventory > 0),
  }
}

// ===== ORDER TOOLS =====

async function getOrderStatus(args: Record<string, unknown>, context: ToolContext) {
  const { orderNumber, email } = args

  const where: Record<string, unknown> = {}
  if (orderNumber) where.orderNumber = orderNumber
  if (context.customerId) {
    where.customerId = context.customerId
  } else if (email) {
    where.customerEmail = email
  } else if (context.customerEmail) {
    where.customerEmail = context.customerEmail
  } else {
    return { error: 'Please provide your order number and email, or sign in to view your orders' }
  }

  const order = await prisma.order.findFirst({
    where,
    include: {
      items: {
        include: {
          product: true,
          productVariant: true,
        },
      },
      shippingAddress: true,
    },
  })

  if (!order) return { error: 'Order not found' }

  return {
    success: true,
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      estimatedDelivery: order.estimatedDelivery,
      items: order.items.map(i => ({
        name: i.product?.name || i.productName,
        size: i.productVariant?.size,
        color: i.productVariant?.color,
        quantity: i.quantity,
        price: i.price,
      })),
      shippingAddress: order.shippingAddress ? {
        firstName: order.shippingAddress.firstName,
        lastName: order.shippingAddress.lastName,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
      } : null,
    },
  }
}

async function getOrderHistory(context: ToolContext) {
  if (!context.customerId) {
    return { error: 'Please sign in to view your order history' }
  }

  const orders = await prisma.order.findMany({
    where: { customerId: context.customerId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      items: {
        include: { product: true },
      },
    },
  })

  return {
    success: true,
    orderCount: orders.length,
    orders: orders.map(o => ({
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt,
      itemCount: o.items.length,
      items: o.items.slice(0, 3).map(i => ({
        name: i.product?.name || i.productName,
        image: i.product ? JSON.parse(i.product.images || '[]')[0] : null,
      })),
    })),
  }
}

// ===== CART TOOLS =====

async function addToCart(args: Record<string, unknown>) {
  // Cart is managed client-side with Zustand
  // Return the info needed for client to add to cart
  const { productId, variantId, quantity = 1 } = args

  const product = await prisma.product.findUnique({
    where: { id: productId as string },
    include: { variants: true },
  })

  if (!product) return { error: 'Product not found' }

  let variant = product.variants[0]
  if (variantId) {
    const found = product.variants.find(v => v.id === variantId)
    if (found) variant = found
  }

  if (!variant || variant.inventory < (quantity as number)) {
    return { error: 'This item is out of stock or insufficient quantity available' }
  }

  return {
    success: true,
    action: 'ADD_TO_CART',
    item: {
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      price: product.price,
      size: variant.size,
      color: variant.color,
      quantity: quantity,
      image: JSON.parse(product.images || '[]')[0],
    },
  }
}

async function getCartSummary(context: ToolContext) {
  // Cart is client-side - return instruction to check client cart
  return {
    success: true,
    action: 'GET_CART',
    message: 'Check client-side cart store for current items',
  }
}

async function applyCoupon(args: Record<string, unknown>) {
  const { code } = args
  const codeUpper = (code as string).toUpperCase()

  // Check if this is a reward redemption coupon code
  const redemption = await prisma.rewardRedemption.findFirst({
    where: {
      couponCode: codeUpper,
      status: 'ACTIVE',
      usedAt: null,
    },
    include: {
      reward: true,
    },
  })

  if (redemption) {
    return {
      success: true,
      coupon: {
        code: codeUpper,
        type: redemption.reward.rewardType, // DISCOUNT, PERCENTAGE, FREE_SHIPPING, etc.
        value: redemption.reward.value,
        description: redemption.reward.description,
      },
    }
  }

  // TODO: Add support for promotional coupon codes when Coupon model is created
  return { error: 'This coupon code is invalid or has expired' }
}

// ===== SUPPORT TOOLS =====

async function createSupportTicket(args: Record<string, unknown>, context: ToolContext) {
  const { type, subject, description, orderId, priority = 'MEDIUM' } = args

  // Generate ticket number
  const count = await prisma.supportTicket.count()
  const ticketNumber = `TKT-${String(count + 1).padStart(4, '0')}`

  // Get customer name if logged in
  let customerName = 'Guest'
  if (context.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: context.customerId },
      select: { name: true, email: true },
    })
    if (customer) {
      customerName = customer.name || customer.email || 'Guest'
    }
  }

  // Build data object for ticket creation
  const ticketData: {
    ticketNumber: string
    type: SupportTicketType
    status: 'OPEN'
    priority: SupportPriority
    subject: string
    customerEmail: string
    customerName: string
    aiAssisted: boolean
    aiSummary: string
    customer?: { connect: { id: string } }
    order?: { connect: { id: string } }
    messages: { create: { message: string; senderType: string; senderName: string } }
  } = {
    ticketNumber,
    type: type as SupportTicketType,
    status: 'OPEN',
    priority: priority as SupportPriority,
    subject: subject as string,
    customerEmail: context.customerEmail || 'unknown@guest.com',
    customerName,
    aiAssisted: true,
    aiSummary: `Ticket created via Reggie AI. Issue: ${description}`,
    messages: {
      create: {
        message: description as string,
        senderType: 'customer',
        senderName: customerName,
      },
    },
  }

  if (context.customerId) {
    ticketData.customer = { connect: { id: context.customerId } }
  }
  if (orderId) {
    ticketData.order = { connect: { id: orderId as string } }
  }

  const ticket = await prisma.supportTicket.create({
    data: ticketData,
  })

  return {
    success: true,
    ticket: {
      ticketNumber: ticket.ticketNumber,
      type: ticket.type,
      status: ticket.status,
      subject: ticket.subject,
      message: 'Your support ticket has been created. Our team will respond within 24 hours.',
    },
  }
}

async function getTicketStatus(args: Record<string, unknown>, context: ToolContext) {
  const { ticketNumber } = args

  const where: Record<string, unknown> = { ticketNumber: ticketNumber as string }
  if (context.customerId) {
    where.customerId = context.customerId
  } else if (context.customerEmail) {
    where.customerEmail = context.customerEmail
  }

  const ticket = await prisma.supportTicket.findFirst({
    where,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!ticket) return { error: 'Ticket not found or you do not have access to view it' }

  return {
    success: true,
    ticket: {
      ticketNumber: ticket.ticketNumber,
      type: ticket.type,
      status: ticket.status,
      priority: ticket.priority,
      subject: ticket.subject,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      recentMessages: ticket.messages.map(m => ({
        from: m.senderType,
        message: m.message,
        date: m.createdAt,
      })),
    },
  }
}

async function requestLiveAgent(args: Record<string, unknown>, context: ToolContext) {
  const { reason, ticketId } = args

  // Check if any agents are available (online and has capacity)
  const availableAgent = await prisma.adminAvailability.findFirst({
    where: {
      isOnline: true,
      status: 'available',
      activeChats: { lt: prisma.adminAvailability.fields.maxChats },
    },
    include: { admin: true },
  })

  return {
    success: true,
    action: 'REQUEST_LIVE_CHAT',
    agentAvailable: !!availableAgent,
    message: availableAgent
      ? 'A live agent is available. Connecting you now...'
      : 'No agents are currently available. Would you like to leave a message or create a support ticket?',
    reason,
    ticketId,
  }
}

// ===== LOYALTY TOOLS =====

async function getLoyaltyStatus(context: ToolContext) {
  if (!context.customerId) {
    return { error: 'Please sign in to view your loyalty status' }
  }

  const customer = await prisma.customer.findUnique({
    where: { id: context.customerId },
    include: { loyaltyTier: true },
  })

  if (!customer) return { error: 'Customer not found' }

  // Get next tier (based on annual points earned)
  const nextTier = await prisma.loyaltyTier.findFirst({
    where: { minAnnualPoints: { gt: customer.annualPointsEarned } },
    orderBy: { minAnnualPoints: 'asc' },
  })

  return {
    success: true,
    loyalty: {
      currentPoints: customer.currentPoints,
      lifetimePoints: customer.lifetimePoints,
      annualPointsEarned: customer.annualPointsEarned,
      tier: customer.loyaltyTier ? {
        name: customer.loyaltyTier.name,
        description: customer.loyaltyTier.description,
        pointsMultiplier: customer.loyaltyTier.pointMultiplier,
        freeShipping: customer.loyaltyTier.freeShipping,
        earlyDropAccess: customer.loyaltyTier.earlyDropAccess,
      } : { name: 'Member', description: 'Earn 1 point per $1 spent', pointsMultiplier: 1.0 },
      nextTier: nextTier ? {
        name: nextTier.name,
        pointsNeeded: nextTier.minAnnualPoints - customer.annualPointsEarned,
      } : null,
    },
  }
}

async function getAvailableRewards() {
  const rewards = await prisma.reward.findMany({
    where: { isActive: true },
    orderBy: { pointsCost: 'asc' },
  })

  return {
    success: true,
    rewards: rewards.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      pointsCost: r.pointsCost,
      rewardType: r.rewardType,
      value: r.value,
    })),
  }
}

async function getReferralCode(context: ToolContext) {
  if (!context.customerId) {
    return { error: 'Please sign in to get your referral code' }
  }

  let referralCode = await prisma.referralCode.findFirst({
    where: { customerId: context.customerId },
  })

  if (!referralCode) {
    // Generate new code
    const code = `HOF${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    referralCode = await prisma.referralCode.create({
      data: {
        code,
        customerId: context.customerId,
      },
    })
  }

  return {
    success: true,
    referral: {
      code: referralCode.code,
      timesUsed: referralCode.timesUsed,
      shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com'}/?ref=${referralCode.code}`,
    },
  }
}
