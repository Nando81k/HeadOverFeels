'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Product } from '@/lib/api/products'
import ProductImage from '@/components/ui/ProductImage'
import { ArrowRight } from '@phosphor-icons/react'

interface SearchResultsProps {
  results: Product[]
  query: string
  onProductClick: () => void
  onViewAll: () => void
}

export function SearchResults({
  results,
  query,
  onProductClick,
  onViewAll,
}: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12"
      >
        <p className="text-black/50 text-lg">
          No results found for &ldquo;{query}&rdquo;
        </p>
        <p className="text-black/30 text-sm mt-2">
          Try a different search term or browse our collections
        </p>
      </motion.div>
    )
  }

  // Parse images helper - handle both flat string arrays and object arrays
  const getFirstImage = (images: string): string => {
    try {
      const parsed = JSON.parse(images)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const firstImg = parsed[0]
        return (typeof firstImg === 'string' ? firstImg : firstImg?.url) || '/placeholder-product.jpg'
      }
      return '/placeholder-product.jpg'
    } catch {
      return images || '/placeholder-product.jpg'
    }
  }

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-widest uppercase text-black/50">
          {results.length} Result{results.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={onViewAll}
          className="group flex items-center gap-1.5 text-xs font-medium tracking-widest uppercase text-black/70 hover:text-black transition-colors"
        >
          View All
          <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {results.slice(0, 8).map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Link
              href={`/products/${product.slug}`}
              onClick={onProductClick}
              className="group block"
            >
              {/* Image */}
              <div className="relative aspect-square bg-[#FAF8F5] rounded-xl overflow-hidden mb-3">
                <ProductImage
                  src={getFirstImage(product.images)}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                {product.isLimitedEdition && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-black text-white text-[10px] font-medium tracking-wider uppercase rounded-full">
                    Limited
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="space-y-0.5">
                <h3 className="text-sm font-medium text-black line-clamp-1 group-hover:underline">
                  {product.name}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-black/70">
                    {formatPrice(product.price)}
                  </span>
                  {product.compareAtPrice && product.compareAtPrice > product.price && (
                    <span className="text-xs text-black/40 line-through">
                      {formatPrice(product.compareAtPrice)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
