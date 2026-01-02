'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CaretDown, CaretUp, ArrowRight } from '@phosphor-icons/react'
import { CollectionCarousel } from '@/components/collections/CollectionCarousel'
import { Button } from '@/components/ui/button'
import { Product } from '@/lib/api/products'

interface CollectionPreviewProps {
  name: string
  description: string
  imageUrl?: string
  products: Product[]
  defaultExpanded?: boolean
}

export function CollectionPreview({
  name,
  description,
  products,
  defaultExpanded = false
}: CollectionPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  // Show carousel for first 6 products, grid for remaining
  const carouselProducts = products.slice(0, 6)
  const additionalProducts = products.slice(6)
  const hasMore = additionalProducts.length > 0

  return (
    <section className="mb-20 last:mb-0">
      {/* Collection Header */}
      <div className="mb-8">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-3xl lg:text-5xl font-black mb-3 text-black tracking-tight uppercase">
              {name}
            </h2>
            <p className="text-base lg:text-lg text-black/70 max-w-3xl">
              {description}
            </p>
          </div>
          <Link
            href={`/collections/${name.toLowerCase().replace(/\s+/g, '-')}`}
            className="hidden lg:inline-flex items-center gap-2 text-black hover:text-black/70 transition-colors text-sm font-bold uppercase tracking-wider"
          >
            View All
            <ArrowRight size={16} weight="bold" />
          </Link>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-black/60 text-sm uppercase tracking-wider">
            {products.length} {products.length === 1 ? 'Product' : 'Products'}
          </span>
        </div>
      </div>

      {/* Products Carousel */}
      {products.length > 0 ? (
        <>
          {/* Main Carousel - Shows 2 products at a time */}
          <div className="mb-12">
            <CollectionCarousel products={carouselProducts} itemsPerView={2} />
          </div>

          {/* Expanded Products Grid */}
          {isExpanded && hasMore && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
              {additionalProducts.map(product => (
                <div key={product.id}>
                  <CollectionCarousel products={[product]} itemsPerView={1} />
                </div>
              ))}
            </div>
          )}

          {/* Expand/Collapse Button */}
          {hasMore && (
            <div className="text-center">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setIsExpanded(!isExpanded)}
                className="min-w-60 border border-black/10 hover:bg-black hover:text-white hover:border-black transition-all duration-300 text-black font-bold uppercase tracking-wider rounded-none"
              >
                {isExpanded ? (
                  <>
                    <CaretUp size={20} weight="bold" className="mr-2" />
                    Show Less
                  </>
                ) : (
                  <>
                    <CaretDown size={20} weight="bold" className="mr-2" />
                    View {additionalProducts.length} More Products
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 bg-black/5 rounded-none border border-black/10">
          <p className="text-black/70 text-xl font-bold mb-2">No products in this collection yet</p>
          <p className="text-black/60 text-sm">Check back soon for new drops!</p>
        </div>
      )}

      {/* Divider */}
      <div className="mt-16 border-t border-black/10" />
    </section>
  )
}
