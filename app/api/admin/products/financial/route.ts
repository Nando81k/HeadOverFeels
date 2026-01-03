import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/products/financial - Get financial data for all products
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // days
    const productId = searchParams.get('productId'); // optional: filter by specific product

    const periodDays = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Build where clause for orders
    const orderWhereClause: Record<string, unknown> = {
      createdAt: { gte: startDate },
      status: { notIn: ['CANCELLED', 'REFUNDED'] }
    };

    // Get all order items with product data within the period
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: orderWhereClause,
        ...(productId ? { productId } : {})
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            costPrice: true,
            isActive: true,
            isLimitedEdition: true,
            variants: {
              select: {
                inventory: true,
              }
            }
          }
        },
        order: {
          select: {
            createdAt: true,
            status: true,
          }
        }
      }
    });

    // Aggregate financial data per product
    const productFinancials: Record<string, {
      productId: string;
      productName: string;
      unitsSold: number;
      revenue: number;
      costOfGoods: number;
      grossProfit: number;
      marginPercent: number;
      currentPrice: number;
      costPrice: number | null;
      currentInventory: number;
      isActive: boolean;
      isLimitedEdition: boolean;
      salesByDay: Record<string, { units: number; revenue: number }>;
    }> = {};

    for (const item of orderItems) {
      if (!item.product) continue;

      const productId = item.product.id;
      const totalInventory = item.product.variants.reduce((sum, v) => sum + v.inventory, 0);
      
      if (!productFinancials[productId]) {
        productFinancials[productId] = {
          productId,
          productName: item.product.name,
          unitsSold: 0,
          revenue: 0,
          costOfGoods: 0,
          grossProfit: 0,
          marginPercent: 0,
          currentPrice: item.product.price,
          costPrice: item.product.costPrice,
          currentInventory: totalInventory,
          isActive: item.product.isActive,
          isLimitedEdition: item.product.isLimitedEdition,
          salesByDay: {},
        };
      }

      const itemRevenue = item.price * item.quantity;
      const itemCost = (item.product.costPrice || 0) * item.quantity;

      productFinancials[productId].unitsSold += item.quantity;
      productFinancials[productId].revenue += itemRevenue;
      productFinancials[productId].costOfGoods += itemCost;

      // Track sales by day for trend analysis
      const dayKey = item.order.createdAt.toISOString().split('T')[0];
      if (!productFinancials[productId].salesByDay[dayKey]) {
        productFinancials[productId].salesByDay[dayKey] = { units: 0, revenue: 0 };
      }
      productFinancials[productId].salesByDay[dayKey].units += item.quantity;
      productFinancials[productId].salesByDay[dayKey].revenue += itemRevenue;
    }

    // Calculate gross profit and margin for each product
    for (const productId in productFinancials) {
      const pf = productFinancials[productId];
      pf.grossProfit = pf.revenue - pf.costOfGoods;
      pf.marginPercent = pf.revenue > 0 ? (pf.grossProfit / pf.revenue) * 100 : 0;
    }

    // Get all products for summary (including those with no sales)
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        costPrice: true,
        isActive: true,
        isLimitedEdition: true,
        variants: {
          select: {
            inventory: true,
          }
        }
      }
    });

    // Add products with no sales to the map
    for (const product of allProducts) {
      if (!productFinancials[product.id]) {
        const totalInventory = product.variants.reduce((sum, v) => sum + v.inventory, 0);
        productFinancials[product.id] = {
          productId: product.id,
          productName: product.name,
          unitsSold: 0,
          revenue: 0,
          costOfGoods: 0,
          grossProfit: 0,
          marginPercent: product.costPrice && product.price > 0 
            ? ((product.price - product.costPrice) / product.price) * 100 
            : 0,
          currentPrice: product.price,
          costPrice: product.costPrice,
          currentInventory: totalInventory,
          isActive: product.isActive,
          isLimitedEdition: product.isLimitedEdition,
          salesByDay: {},
        };
      }
    }

    // Calculate summary statistics
    const financialsArray = Object.values(productFinancials);
    const totalRevenue = financialsArray.reduce((sum, p) => sum + p.revenue, 0);
    const totalUnitsSold = financialsArray.reduce((sum, p) => sum + p.unitsSold, 0);
    const totalCostOfGoods = financialsArray.reduce((sum, p) => sum + p.costOfGoods, 0);
    const totalGrossProfit = totalRevenue - totalCostOfGoods;
    const avgMarginPercent = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

    // Find best seller by revenue
    const bestSeller = financialsArray.reduce((best, current) => 
      current.revenue > (best?.revenue || 0) ? current : best
    , financialsArray[0] || null);

    // Find products with low margin (under 20%)
    const lowMarginProducts = financialsArray.filter(p => 
      p.costPrice !== null && p.marginPercent < 20 && p.marginPercent > 0
    );

    // Find trending products (sales increasing over period)
    const trendingProducts = financialsArray
      .filter(p => p.unitsSold > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        period: periodDays,
        periodStart: startDate.toISOString(),
        periodEnd: new Date().toISOString(),
        summary: {
          totalRevenue,
          totalUnitsSold,
          totalCostOfGoods,
          totalGrossProfit,
          avgMarginPercent: Math.round(avgMarginPercent * 10) / 10,
          bestSeller: bestSeller ? {
            productId: bestSeller.productId,
            productName: bestSeller.productName,
            revenue: bestSeller.revenue,
            unitsSold: bestSeller.unitsSold,
          } : null,
          lowMarginCount: lowMarginProducts.length,
          trendingProducts: trendingProducts.map(p => ({
            productId: p.productId,
            productName: p.productName,
            revenue: p.revenue,
            unitsSold: p.unitsSold,
          })),
        },
        products: financialsArray.sort((a, b) => b.revenue - a.revenue),
      }
    });
  } catch (error) {
    console.error('Error fetching product financials:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product financial data' },
      { status: 500 }
    );
  }
}
