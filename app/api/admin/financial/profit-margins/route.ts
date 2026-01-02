import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";

interface ProductProfit {
  productId: string;
  name: string;
  sku: string;
  sellingPrice: number;
  costPrice: number | null;
  profitMargin: number | null;
  profitPerUnit: number | null;
  totalInventory: number;
  potentialProfit: number | null;
  category: string | null;
  status: string;
  isLimitedEdition: boolean;
  hasVariants: boolean;
  variants?: VariantProfit[];
}

interface VariantProfit {
  variantId: string;
  sku: string;
  size: string | null;
  color: string | null;
  sellingPrice: number;
  costPrice: number | null;
  profitMargin: number | null;
  profitPerUnit: number | null;
  inventory: number;
  potentialProfit: number | null;
}

interface SummaryStats {
  totalProducts: number;
  productsWithCosts: number;
  avgProfitMargin: number;
  totalPotentialProfit: number;
  lowMarginCount: number;
  negativeProfitCount: number;
}

export async function GET(request: NextRequest) {
  // Verify admin authentication
  const adminVerified = await verifyAdmin(request);
  if (!adminVerified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all products with variants and category
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        variants: {
          where: {
            isActive: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const productProfits: ProductProfit[] = [];
    let totalMargin = 0;
    let productsWithCosts = 0;
    let totalPotentialProfit = 0;
    let lowMarginCount = 0;
    let negativeProfitCount = 0;

    for (const product of products) {
      const hasVariants = product.variants.length > 0;
      let totalInventory = 0;
      let productPotentialProfit = 0;
      const variantProfits: VariantProfit[] = [];

      // If product has variants, calculate per-variant profits
      if (hasVariants) {
        for (const variant of product.variants) {
          const sellingPrice = variant.price ?? product.price;
          const costPrice = variant.costPrice ?? product.costPrice;
          const inventory = variant.inventory;

          let profitMargin: number | null = null;
          let profitPerUnit: number | null = null;
          let potentialProfit: number | null = null;

          if (costPrice !== null) {
            profitPerUnit = sellingPrice - costPrice;
            profitMargin = ((profitPerUnit / sellingPrice) * 100);
            potentialProfit = profitPerUnit * inventory;
            productPotentialProfit += potentialProfit;
          }

          totalInventory += inventory;

          variantProfits.push({
            variantId: variant.id,
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            sellingPrice,
            costPrice,
            profitMargin,
            profitPerUnit,
            inventory,
            potentialProfit,
          });
        }
      } else {
        // No variants - use product-level pricing
        totalInventory = product.variants[0]?.inventory ?? 0;
      }

      // Calculate product-level profit (average of variants or direct)
      let productMargin: number | null = null;
      let productProfitPerUnit: number | null = null;

      if (hasVariants) {
        // Average margin across variants (weighted by inventory)
        const variantsWithMargin = variantProfits.filter(
          (v) => v.profitMargin !== null
        );
        if (variantsWithMargin.length > 0) {
          const totalWeightedMargin = variantsWithMargin.reduce(
            (sum, v) => sum + (v.profitMargin ?? 0) * v.inventory,
            0
          );
          const totalWeight = variantsWithMargin.reduce(
            (sum, v) => sum + v.inventory,
            0
          );
          productMargin = totalWeight > 0 ? totalWeightedMargin / totalWeight : 0;

          // Average profit per unit (weighted)
          const totalWeightedProfit = variantsWithMargin.reduce(
            (sum, v) => sum + (v.profitPerUnit ?? 0) * v.inventory,
            0
          );
          productProfitPerUnit = totalWeight > 0 ? totalWeightedProfit / totalWeight : 0;
        }
      } else {
        // Direct calculation for products without variants
        if (product.costPrice !== null) {
          productProfitPerUnit = product.price - product.costPrice;
          productMargin = ((productProfitPerUnit / product.price) * 100);
          productPotentialProfit = productProfitPerUnit * totalInventory;
        }
      }

      // Update summary stats
      if (productMargin !== null) {
        totalMargin += productMargin;
        productsWithCosts++;
        totalPotentialProfit += productPotentialProfit;

        if (productMargin < 0) {
          negativeProfitCount++;
        } else if (productMargin < 20) {
          lowMarginCount++;
        }
      }

      productProfits.push({
        productId: product.id,
        name: product.name,
        sku: product.variants[0]?.sku ?? "N/A",
        sellingPrice: product.price,
        costPrice: product.costPrice,
        profitMargin: productMargin,
        profitPerUnit: productProfitPerUnit,
        totalInventory,
        potentialProfit: productPotentialProfit > 0 ? productPotentialProfit : null,
        category: product.category?.name ?? null,
        status: product.isActive ? "active" : "inactive",
        isLimitedEdition: product.isLimitedEdition,
        hasVariants,
        variants: hasVariants ? variantProfits : undefined,
      });
    }

    const summary: SummaryStats = {
      totalProducts: products.length,
      productsWithCosts,
      avgProfitMargin: productsWithCosts > 0 ? totalMargin / productsWithCosts : 0,
      totalPotentialProfit,
      lowMarginCount,
      negativeProfitCount,
    };

    return NextResponse.json({
      products: productProfits,
      summary,
    });
  } catch (error) {
    console.error("Error calculating profit margins:", error);
    return NextResponse.json(
      { error: "Failed to calculate profit margins" },
      { status: 500 }
    );
  }
}
