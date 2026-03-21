'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react'
import { ProductRecommendation } from './ProductCarousel'

interface ProductCardProps {
  product: ProductRecommendation
  sourceProductId?: string // The product that triggered this recommendation
  trackingType?: string
  onClick?: () => void
}

interface ParsedImage {
  url: string
}

const FALLBACK_IMAGE = '/placeholder-product.jpg'

const parseImages = (value: unknown): ParsedImage[] => {
  let parsed: unknown = value

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []

    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      return [{ url: trimmed }]
    }

    try {
      parsed = JSON.parse(trimmed)
    } catch {
      return []
    }
  }

  if (!Array.isArray(parsed)) return []

  return parsed
    .map((item) => {
      if (typeof item === 'string' && item.trim().length > 0) {
        return { url: item.trim() }
      }

      if (typeof item === 'object' && item !== null && 'url' in item) {
        const rawUrl = (item as { url?: unknown }).url
        if (typeof rawUrl === 'string' && rawUrl.trim().length > 0) {
          return { url: rawUrl.trim() }
        }
      }

      return null
    })
    .filter((image): image is ParsedImage => Boolean(image))
}

export function ProductCard({ product, sourceProductId, trackingType, onClick }: ProductCardProps) {
  const imageSet = parseImages(product.images)
  const primaryImage = imageSet[0]?.url || FALLBACK_IMAGE
  const secondaryImage = imageSet[1]?.url || primaryImage

  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discountPercentage = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0

  const totalInventory = product.variants?.reduce((total, variant) => {
    if (typeof variant.inventory !== 'number') return total
    return total + Math.max(0, variant.inventory)
  }, 0)

  const lowStock = typeof totalInventory === 'number' && totalInventory > 0 && totalInventory <= 5
  const soldOut = typeof totalInventory === 'number' && totalInventory <= 0

  const colorCount = product.variants
    ? new Set(
        product.variants
          .map((variant) => (typeof variant.color === 'string' ? variant.color.trim().toLowerCase() : ''))
          .filter(Boolean)
      ).size
    : 0

  const handleClick = async () => {
    onClick?.()

    // Track recommendation click
    if (sourceProductId && trackingType) {
      try {
        await fetch('/api/recommendations/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'click',
            sourceProductId,
            targetProductId: product.id,
            type: trackingType.toUpperCase(),
          }),
        })

        // Store click in sessionStorage for conversion attribution
        const clicks = JSON.parse(sessionStorage.getItem('recommendation_clicks') || '[]')
        clicks.push({
          sourceProductId,
          targetProductId: product.id,
          type: trackingType.toUpperCase(),
          timestamp: Date.now(),
        })
        // Keep only last 20 clicks, expire after 7 days
        const recentClicks = clicks.filter(
          (c: { timestamp: number }) => Date.now() - c.timestamp < 7 * 24 * 60 * 60 * 1000
        ).slice(-20)
        sessionStorage.setItem('recommendation_clicks', JSON.stringify(recentClicks))
      } catch (error) {
        console.error('Failed to track recommendation click:', error)
      }
    }
  }

  return (
    <Link
      href={`/products/${product.slug}`}
      onClick={handleClick}
      className="group block rounded-2xl border border-black/10 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-black/30 hover:shadow-[0_14px_30px_rgba(0,0,0,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
        <Image
          src={primaryImage}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 68vw, (max-width: 1024px) 34vw, 280px"
        />

        {secondaryImage !== primaryImage && (
          <Image
            src={secondaryImage}
            alt={`${product.name} alternate view`}
            fill
            className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            sizes="(max-width: 640px) 68vw, (max-width: 1024px) 34vw, 280px"
          />
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {hasDiscount && (
          <div className="absolute left-3 top-3">
            <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-black tracking-[0.14em] text-white">
              SAVE {discountPercentage}%
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2.5 p-4">
        {product.category && (
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-black/55">
            {product.category.name}
          </p>
        )}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-black">
          {product.name}
        </h3>

        <div className="flex items-end justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-black">
              ${product.price.toFixed(2)}
            </span>
            {hasDiscount && (
              <span className="text-xs font-medium text-black/40 line-through">
                ${product.compareAtPrice!.toFixed(2)}
              </span>
            )}
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-black/70 transition-colors group-hover:text-black">
            View
            <ArrowRight size={12} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>

        {colorCount > 0 && (
          <p className="text-[11px] font-medium text-black/45">
            {colorCount} color{colorCount > 1 ? 's' : ''} available
          </p>
        )}

        {!soldOut && lowStock && (
          <p className="text-[11px] font-medium text-black/55">
            Only {totalInventory} left across variants
          </p>
        )}

        {soldOut && (
          <p className="text-[11px] font-medium text-black/40">
            Currently unavailable
          </p>
        )}
      </div>
    </Link>
  )
}
