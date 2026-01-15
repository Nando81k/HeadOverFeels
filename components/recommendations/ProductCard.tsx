'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ProductRecommendation } from './ProductCarousel'

interface ProductCardProps {
  product: ProductRecommendation
  sourceProductId?: string  // The product that triggered this recommendation
  trackingType?: string
  onClick?: () => void
}

export function ProductCard({ product, sourceProductId, trackingType, onClick }: ProductCardProps) {
  const images = JSON.parse(product.images as string) as string[]
  const mainImage = images[0] || '/placeholder-product.jpg'
  
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discountPercentage = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
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
      className="group block bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
        <Image
          src={mainImage}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="280px"
        />
        {hasDiscount && (
          <div className="absolute top-3 right-3 bg-red-500 text-white px-2 py-1 rounded-md text-sm font-semibold">
            -{discountPercentage}%
          </div>
        )}
        {product.recommendationReason && (
          <div className="absolute bottom-3 left-3 bg-black/70 text-white px-3 py-1 rounded-full text-xs">
            {product.recommendationReason}
          </div>
        )}
      </div>

      <div className="p-4">
        {product.category && (
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            {product.category.name}
          </p>
        )}
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
          {product.name}
        </h3>
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900">
            ${product.price.toFixed(2)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-gray-400 line-through">
              ${product.compareAtPrice!.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
