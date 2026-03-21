'use client'

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { ProductCard } from '@/components/recommendations/ProductCard'

interface RecommendationVariant {
  id: string
  size?: string | null
  color?: string | null
  inventory: number
}

export interface ProductRecommendation {
  id: string
  name: string
  slug: string
  price: number
  compareAtPrice?: number | null
  images: unknown
  category?: {
    id: string
    name: string
  } | null
  variants?: RecommendationVariant[]
  recommendationScore?: number
  recommendationReason?: string
}

interface ProductCarouselProps {
  products: ProductRecommendation[]
  title: string
  subtitle?: string
  sourceProductId?: string // The product that triggered these recommendations
  trackingType?: string
  onProductClick?: (productId: string) => void
}

interface VisibleRange {
  start: number
  end: number
}

export function ProductCarousel({
  products,
  title,
  subtitle,
  sourceProductId,
  trackingType = 'general',
  onProductClick,
}: ProductCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(1)
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({
    start: products.length > 0 ? 1 : 0,
    end: products.length > 0 ? 1 : 0,
  })

  const updateCarouselState = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const maxScrollLeft = container.scrollWidth - container.clientWidth
    const hasOverflow = maxScrollLeft > 6

    setCanScrollLeft(container.scrollLeft > 6)
    setCanScrollRight(container.scrollLeft < maxScrollLeft - 6)

    const rawProgress = hasOverflow ? container.scrollLeft / maxScrollLeft : 1
    setScrollProgress(Math.min(1, Math.max(0, rawProgress)))

    const firstCard = container.querySelector<HTMLElement>('[data-carousel-item]')
    if (!firstCard) {
      setVisibleRange({ start: 0, end: 0 })
      return
    }

    const computedStyle = window.getComputedStyle(container)
    const gap = Number.parseFloat(computedStyle.columnGap || computedStyle.gap || '0') || 0
    const itemWidth = firstCard.offsetWidth || 1
    const unitSize = Math.max(1, itemWidth + gap)

    const startIndex = Math.floor(container.scrollLeft / unitSize)
    const visibleCount = Math.max(1, Math.ceil((container.clientWidth + gap) / unitSize))
    const clampedStart = Math.min(products.length, startIndex + 1)
    const clampedEnd = Math.min(products.length, startIndex + visibleCount)

    setVisibleRange({
      start: products.length === 0 ? 0 : Math.max(1, clampedStart),
      end: products.length === 0 ? 0 : Math.max(1, clampedEnd),
    })
  }, [products.length])

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
          targetProductIds: products.map((product) => product.id),
          type: trackingType.toUpperCase(),
        }),
      })
    } catch (error) {
      console.error('Failed to track impressions:', error)
    }
  }, [sourceProductId, products, trackingType])

  useEffect(() => {
    updateCarouselState()

    const container = scrollContainerRef.current
    if (!container) return

    container.addEventListener('scroll', updateCarouselState, { passive: true })
    window.addEventListener('resize', updateCarouselState)

    trackImpressions()

    return () => {
      container.removeEventListener('scroll', updateCarouselState)
      window.removeEventListener('resize', updateCarouselState)
    }
  }, [trackImpressions, updateCarouselState])

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return

    const scrollAmount = Math.max(container.clientWidth * 0.8, 260)

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  const handleCarouselKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scroll('left')
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      scroll('right')
    }
  }

  if (products.length === 0) {
    return null
  }

  const progressWidth = `${Math.max(8, Math.round(scrollProgress * 100))}%`

  return (
    <section aria-label={title} className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-black/55">
            Personalized Picks
          </p>
          <h2 className="text-2xl font-black tracking-tight text-black sm:text-3xl">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-black/65">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/45">
            {visibleRange.start}-{visibleRange.end} of {products.length}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white text-black transition-colors hover:border-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:border-black/10 disabled:text-black/25 disabled:hover:bg-white"
              aria-label="Scroll left"
            >
              <CaretLeft size={18} weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white text-black transition-colors hover:border-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:border-black/10 disabled:text-black/25 disabled:hover:bg-white"
              aria-label="Scroll right"
            >
              <CaretRight size={18} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-black transition-[width] duration-200"
          style={{ width: progressWidth }}
        />
      </div>

      <div className="relative">
        {canScrollLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-white to-transparent" />
        )}
        {canScrollRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-white to-transparent" />
        )}

        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:gap-5"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          tabIndex={0}
          onKeyDown={handleCarouselKeyDown}
          aria-label={`${title} product carousel`}
          data-testid="recommendation-carousel"
        >
          {products.map((product) => (
            <div
              key={product.id}
              data-carousel-item
              className="flex-none w-[72vw] max-w-[260px] snap-start sm:w-[250px] lg:w-[280px]"
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
