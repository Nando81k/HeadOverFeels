'use client'

import { useMemo } from 'react'
import type { Product, ProductVariant } from '@/lib/api/products'
import { resolveColorHex } from '@/lib/commerce/product-placeholders'
import { ProductCard as CatalogProductCard } from '@/components/products/ProductCard'
import { ProductRecommendation } from './ProductCarousel'

interface ProductCardProps {
  product: ProductRecommendation
  sourceProductId?: string
  trackingType?: string
  onClick?: () => void
}

function toCategorySlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'products'
}

function normalizeImages(images: unknown): string {
  if (typeof images === 'string') {
    const trimmed = images.trim()
    return trimmed.length > 0 ? trimmed : '[]'
  }

  if (Array.isArray(images)) {
    return JSON.stringify(images)
  }

  return '[]'
}

function normalizeVariants(product: ProductRecommendation): ProductVariant[] {
  if (!Array.isArray(product.variants) || product.variants.length === 0) {
    return [{
      id: `${product.id}-default`,
      sku: `${product.slug}-default`,
      inventory: 99,
      isActive: true,
    }]
  }

  return product.variants.map((variant, index) => {
    const color = typeof variant.color === 'string' ? variant.color : undefined
    const colorHex = resolveColorHex(undefined, color) ?? undefined
    return {
      id: variant.id || `${product.id}-variant-${index}`,
      sku: `${product.slug}-${variant.id || index}`,
      size: typeof variant.size === 'string' ? variant.size : undefined,
      color,
      colorHex,
      inventory: Number.isFinite(variant.inventory) ? Math.max(0, variant.inventory) : 0,
      isActive: true,
    }
  })
}

export function ProductCard({ product, sourceProductId, trackingType, onClick }: ProductCardProps) {
  const normalizedProduct = useMemo<Product>(() => {
    const category = product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          slug: toCategorySlug(product.category.name),
        }
      : undefined

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? undefined,
      images: normalizeImages(product.images),
      isActive: true,
      isFeatured: false,
      categoryId: category?.id,
      category,
      variants: normalizeVariants(product),
      createdAt: '',
      updatedAt: '',
    }
  }, [product])

  const handleClick = () => {
    onClick?.()

    if (!sourceProductId || !trackingType) {
      return
    }

    void fetch('/api/recommendations/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'click',
        sourceProductId,
        targetProductId: product.id,
        type: trackingType.toUpperCase(),
      }),
    }).catch((error) => {
      console.error('Failed to track recommendation click:', error)
    })

    try {
      const clicks = JSON.parse(sessionStorage.getItem('recommendation_clicks') || '[]')
      clicks.push({
        sourceProductId,
        targetProductId: product.id,
        type: trackingType.toUpperCase(),
        timestamp: Date.now(),
      })

      const recentClicks = clicks.filter(
        (click: { timestamp: number }) => Date.now() - click.timestamp < 7 * 24 * 60 * 60 * 1000
      ).slice(-20)
      sessionStorage.setItem('recommendation_clicks', JSON.stringify(recentClicks))
    } catch (error) {
      console.error('Failed to persist recommendation click:', error)
    }
  }

  return (
    <CatalogProductCard
      product={normalizedProduct}
      onProductClick={handleClick}
    />
  )
}
