'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Flame } from '@phosphor-icons/react'

interface TrendingProduct {
  id: string
  name: string
  slug: string
  price: number
  compareAtPrice?: number | null
  images: string
  category?: {
    name: string
  } | null
  trendingScore?: number
}

interface TrendingProductsProps {
  limit?: number
  categoryId?: string
}

export function TrendingProducts({ limit = 8, categoryId }: TrendingProductsProps) {
  const [products, setProducts] = useState<TrendingProduct[]>([])
  const [loading, setLoading] = useState(true)

  // Track impressions for trending products
  const trackImpressions = useCallback(async (productIds: string[]) => {
    if (productIds.length === 0) return
    try {
      // For trending, we use a special "TRENDING" source ID since there's no source product
      await fetch('/api/recommendations/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'batch_impression',
          sourceProductId: 'TRENDING_HOMEPAGE', // Special identifier for trending section
          targetProductIds: productIds,
          type: 'TRENDING',
        }),
      })
    } catch (error) {
      console.error('Failed to track trending impressions:', error)
    }
  }, [])

  // Track click on trending product
  const handleProductClick = async (productId: string) => {
    try {
      await fetch('/api/recommendations/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'click',
          sourceProductId: 'TRENDING_HOMEPAGE',
          targetProductId: productId,
          type: 'TRENDING',
        }),
      })
      
      // Store click for conversion attribution
      const clicks = JSON.parse(sessionStorage.getItem('recommendation_clicks') || '[]')
      clicks.push({
        sourceProductId: 'TRENDING_HOMEPAGE',
        targetProductId: productId,
        type: 'TRENDING',
        timestamp: Date.now(),
      })
      const recentClicks = clicks.filter(
        (c: { timestamp: number }) => Date.now() - c.timestamp < 7 * 24 * 60 * 60 * 1000
      ).slice(-20)
      sessionStorage.setItem('recommendation_clicks', JSON.stringify(recentClicks))
    } catch (error) {
      console.error('Failed to track trending click:', error)
    }
  }

  useEffect(() => {
    async function fetchTrendingProducts() {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          limit: limit.toString(),
          ...(categoryId && { categoryId }),
        })
        
        const response = await fetch(`/api/recommendations/trending?${params}`)
        const data = await response.json()
        
        if (data.success) {
          const recommendations = data.data.recommendations || []
          setProducts(recommendations)
          
          // Track impressions when products are loaded
          trackImpressions(recommendations.map((p: TrendingProduct) => p.id))
        }
      } catch (err) {
        console.error('Error fetching trending products:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTrendingProducts()
  }, [limit, categoryId, trackImpressions])

  if (loading) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-10">
            <Flame size={32} weight="bold" className="text-orange-500" />
            <h2 className="text-4xl font-bold text-gray-900">Trending Now</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-gray-200 animate-pulse rounded-lg aspect-3/4"
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (products.length === 0) {
    return null
  }

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-10">
          <Flame size={32} weight="bold" className="text-orange-500 animate-pulse" />
          <h2 className="text-4xl font-bold text-gray-900">Trending Now</h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {products.map((product, index) => {
            const images = JSON.parse(product.images as string) as string[]
            const mainImage = images[0] || '/placeholder-product.jpg'
            const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price

            return (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                onClick={() => handleProductClick(product.id)}
                className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all"
              >
                {index < 3 && (
                  <div className="absolute top-3 left-3 z-10 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <Flame size={12} weight="bold" />
                    #{index + 1}
                  </div>
                )}
                
                <div className="relative aspect-3/4 overflow-hidden bg-gray-100">
                  <Image
                    src={mainImage}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
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
          })}
        </div>
      </div>
    </section>
  )
}
