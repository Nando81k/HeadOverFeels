import { prisma } from '@/lib/prisma'
import { awardPurchasePoints, awardFirstPurchasePoints, updateCustomerTier } from '@/lib/loyalty/service'

/**
 * CRM Service
 * Automatically updates customer stats and triggers loyalty actions
 */

/**
 * Update customer CRM stats after order completion
 * Updates: totalSpent, totalOrders, avgOrderValue, lastOrderDate, annualSpend
 * Also awards loyalty points and checks for tier upgrades
 */
export async function updateCustomerStatsOnOrderCompletion(
  customerId: string,
  orderId: string,
  orderTotal: number
) {
  try {
    // Get current customer stats
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        totalSpent: true,
        totalOrders: true,
        annualSpend: true,
        tierStartDate: true,
      },
    })

    if (!customer) {
      console.error(`Customer ${customerId} not found`)
      return
    }

    const isFirstOrder = customer.totalOrders === 0

    // Calculate new stats
    const newTotalSpent = customer.totalSpent + orderTotal
    const newTotalOrders = customer.totalOrders + 1
    const newAvgOrderValue = newTotalSpent / newTotalOrders

    // Calculate annual spend (reset yearly from tierStartDate)
    const now = new Date()
    const tierStartDate = new Date(customer.tierStartDate)
    const yearsSinceTierStart = (now.getTime() - tierStartDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
    
    // If more than a year since tier started, reset annual spend
    let newAnnualSpend = customer.annualSpend + orderTotal
    let shouldResetTierDate = false
    
    if (yearsSinceTierStart >= 1) {
      newAnnualSpend = orderTotal // Reset to just this order
      shouldResetTierDate = true
    }

    // Update customer stats
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalSpent: newTotalSpent,
        totalOrders: newTotalOrders,
        avgOrderValue: newAvgOrderValue,
        lastOrderDate: now,
        annualSpend: newAnnualSpend,
        ...(shouldResetTierDate && { tierStartDate: now }),
      },
    })

    console.log(`✅ Updated CRM stats for customer ${customerId}:`, {
      totalSpent: newTotalSpent,
      totalOrders: newTotalOrders,
      avgOrderValue: newAvgOrderValue,
      annualSpend: newAnnualSpend,
    })

    // Award loyalty points (respects tier multipliers).
    // Stable per-order key prevents double-awarding on duplicate CRM calls.
    await awardPurchasePoints(customerId, orderId, orderTotal, `order-purchase-${orderId}`)

    // Award first purchase bonus if applicable.
    if (isFirstOrder) {
      await awardFirstPurchasePoints(customerId, orderId, `order-first-purchase-${orderId}`)
    }

    // Check and update tier based on new annual spend
    const tierUpgrade = await updateCustomerTier(customerId)
    if (tierUpgrade) {
      console.log(`🎉 Customer ${customerId} upgraded to ${tierUpgrade.name} tier!`)
    }

    return {
      updated: true,
      isFirstOrder,
      tierUpgrade: tierUpgrade?.name,
      pointsAwarded: true,
    }
  } catch (error) {
    console.error('Error updating customer CRM stats:', error)
    throw error
  }
}

/**
 * Update customer stats when order is refunded
 * Reverses the CRM stat changes
 */
export async function updateCustomerStatsOnOrderRefund(
  customerId: string,
  orderTotal: number
) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        totalSpent: true,
        totalOrders: true,
      },
    })

    if (!customer) {
      console.error(`Customer ${customerId} not found`)
      return
    }

    // Reverse stats (but don't go below 0)
    const newTotalSpent = Math.max(0, customer.totalSpent - orderTotal)
    const newTotalOrders = Math.max(0, customer.totalOrders - 1)
    const newAvgOrderValue = newTotalOrders > 0 ? newTotalSpent / newTotalOrders : 0

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalSpent: newTotalSpent,
        totalOrders: newTotalOrders,
        avgOrderValue: newAvgOrderValue,
        annualSpend: Math.max(0, customer.totalSpent - orderTotal), // Simplified - could be more accurate
      },
    })

    console.log(`♻️ Reversed CRM stats for customer ${customerId} due to refund`)

    // Note: We don't reverse loyalty points here - that's handled by loyalty service separately
    // Customer keeps the points but stats are adjusted

    return { updated: true }
  } catch (error) {
    console.error('Error reversing customer CRM stats:', error)
    throw error
  }
}

/**
 * Batch update customer stats (for data migrations or corrections)
 */
export async function recalculateCustomerStats(customerId: string) {
  try {
    // Get all completed orders for this customer
    const orders = await prisma.order.findMany({
      where: {
        customerId,
        status: {
          in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'],
        },
      },
      select: {
        total: true,
        createdAt: true,
      },
    })

    if (orders.length === 0) {
      console.log(`No completed orders found for customer ${customerId}`)
      return
    }

    // Calculate totals
    const totalSpent = orders.reduce((sum, order) => sum + order.total, 0)
    const totalOrders = orders.length
    const avgOrderValue = totalSpent / totalOrders
    const lastOrderDate = orders.reduce((latest, order) => 
      order.createdAt > latest ? order.createdAt : latest, 
      orders[0].createdAt
    )

    // Calculate annual spend (last 365 days)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    
    const annualSpend = orders
      .filter(order => order.createdAt >= oneYearAgo)
      .reduce((sum, order) => sum + order.total, 0)

    // Update customer
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalSpent,
        totalOrders,
        avgOrderValue,
        lastOrderDate,
        annualSpend,
      },
    })

    console.log(`✅ Recalculated CRM stats for customer ${customerId}:`, {
      totalSpent,
      totalOrders,
      avgOrderValue,
      annualSpend,
    })

    // Update tier based on recalculated annual spend
    await updateCustomerTier(customerId)

    return {
      updated: true,
      totalSpent,
      totalOrders,
      avgOrderValue,
      annualSpend,
    }
  } catch (error) {
    console.error('Error recalculating customer CRM stats:', error)
    throw error
  }
}
