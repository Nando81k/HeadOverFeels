'use client'

import { useEffect, useState } from 'react'
import { ProductCarousel, ProductRecommendation } from './ProductCarousel'

interface SimilarProductsProps {
  productId: string
  limit?: number
}

export function SimilarProducts({ productId, limit = 6 }: SimilarProductsProps) {
  const [products, setProducts] = useState<ProductRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSimilarProducts() {
      try {
        setLoading(true)
        const response = await fetch(
          `/api/recommendations/similar/${productId}?limit=${limit}`
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch similar products')
        }

        const data = await response.json()
        setProducts(data.data.recommendations || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        console.error('Error fetching similar products:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSimilarProducts()
  }, [productId, limit])

  if (loading) {
    return (
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            You Might Also Like
          </h2>
          <div className="flex gap-6 overflow-hidden">
            {Array.from({ length: limit }).map((_, i) => (
              <div
                key={i}
                className="flex-none w-[280px] bg-gray-200 animate-pulse rounded-lg h-[400px]"
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (error || products.length === 0) {
    return null
  }

  return (
    <ProductCarousel
      products={products}
      title="You Might Also Like"
      sourceProductId={productId}
      trackingType="similar"
    />
  )
}
