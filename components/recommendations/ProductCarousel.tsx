'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { ProductCard } from '@/components/recommendations/ProductCard'

export interface ProductRecommendation {
  id: string
  name: string
  slug: string
  price: number
  compareAtPrice?: number | null
  images: string
  category?: {
    id: string
    name: string
  } | null
  recommendationScore?: number
  recommendationReason?: string
}

interface ProductCarouselProps {
  products: ProductRecommendation[]
  title: string
  sourceProductId?: string  // The product that triggered these recommendations
  trackingType?: string
  onProductClick?: (productId: string) => void
}

export function ProductCarousel({
  products,
  title,
  sourceProductId,
  trackingType = 'general',
  onProductClick,
}: ProductCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScrollability = () => {
    const container = scrollContainerRef.current
    if (!container) return

    setCanScrollLeft(container.scrollLeft > 0)
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 10
    )
  }

  // Track batch impressions when products are first displayed
  const trackImpressions = useCallback(async () => {
    if (!sourceProductId || products.length === 0) return

    try {
      await fetch('/api/recommendations/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'batch_impression',
          sourceProductId,
          targetProductIds: products.map(p => p.id),
          type: trackingType.toUpperCase(),
        }),
      })
    } catch (error) {
      console.error('Failed to track impressions:', error)
    }
  }, [sourceProductId, products, trackingType])

  useEffect(() => {
    checkScrollability()
    const container = scrollContainerRef.current
    if (!container) return

    container.addEventListener('scroll', checkScrollability)
    window.addEventListener('resize', checkScrollability)

    // Track impressions on mount
    trackImpressions()

    return () => {
      container.removeEventListener('scroll', checkScrollability)
      window.removeEventListener('resize', checkScrollability)
    }
  }, [products, trackImpressions])

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return

    const scrollAmount = container.clientWidth * 0.8
    const newScrollLeft =
      direction === 'left'
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount

    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth',
    })
  }

  if (products.length === 0) {
    return null
  }

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="p-2 rounded-full border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Scroll left"
            >
              <CaretLeft size={20} weight="bold" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="p-2 rounded-full border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Scroll right"
            >
              <CaretRight size={20} weight="bold" />
            </button>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="flex-none w-[280px] snap-start"
            >
              <ProductCard
                product={product}
                sourceProductId={sourceProductId}
                trackingType={trackingType}
                onClick={() => onProductClick?.(product.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
