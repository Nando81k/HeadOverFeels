'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { ArrowsClockwise, ArrowRight } from '@phosphor-icons/react'
import { ProductCarousel, ProductRecommendation } from './ProductCarousel'

interface SimilarProductsProps {
  productId: string
  limit?: number
}

export function SimilarProducts({ productId, limit = 8 }: SimilarProductsProps) {
  const [products, setProducts] = useState<ProductRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const fetchSimilarProducts = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/recommendations/similar/${productId}?limit=${limit}`,
        { signal }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch similar products')
      }

      const data = await response.json()
      setProducts(data.data.recommendations || [])
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Error fetching similar products:', err)
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [productId, limit])

  useEffect(() => {
    const controller = new AbortController()
    fetchSimilarProducts(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchSimilarProducts, retryCount])

  const handleRetry = () => {
    setRetryCount((count) => count + 1)
  }

  if (loading) {
    return (
      <section className="space-y-5" data-testid="similar-products-loading">
        <div className="space-y-2">
          <div className="h-2.5 w-28 animate-pulse rounded-full bg-black/10" />
          <div className="h-8 w-64 animate-pulse rounded-full bg-black/10" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-full bg-black/10" />
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-black/20" />
        </div>

        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: limit }).map((_, index) => (
            <div
              key={index}
              className="h-[380px] w-[72vw] max-w-[260px] flex-none animate-pulse rounded-2xl bg-black/5 sm:w-[250px] lg:w-[280px]"
            />
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-black/15 bg-neutral-50 p-6 sm:p-8" data-testid="similar-products-error">
        <div className="max-w-xl space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-black/55">
            Personalized Picks
          </p>
          <h2 className="text-2xl font-black tracking-tight text-black sm:text-3xl">
            You May Also Like
          </h2>
          <p className="text-sm text-black/60">
            We could not load recommendations right now.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 rounded-full border border-black/25 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-black transition-colors hover:bg-black hover:text-white"
          >
            <ArrowsClockwise size={14} weight="bold" />
            Try Again
          </button>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-black/70 transition-colors hover:text-black"
          >
            Browse All Products
            <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      </section>
    )
  }

  if (products.length === 0) {
    return (
      <section className="rounded-3xl border border-black/10 bg-white p-6 sm:p-8" data-testid="similar-products-empty">
        <div className="max-w-xl space-y-2.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-black/55">
            Personalized Picks
          </p>
          <h2 className="text-2xl font-black tracking-tight text-black sm:text-3xl">
            You May Also Like
          </h2>
          <p className="text-sm text-black/60">
            No recommendations yet for this product.
          </p>
        </div>

        <Link
          href="/products"
          className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-black/75 transition-colors hover:text-black"
        >
          Explore All Products
          <ArrowRight size={14} weight="bold" />
        </Link>
      </section>
    )
  }

  return (
    <ProductCarousel
      products={products}
      title="You May Also Like"
      subtitle="Recommended from similar style, category, and shopper behavior."
      sourceProductId={productId}
      trackingType="similar"
    />
  )
}
