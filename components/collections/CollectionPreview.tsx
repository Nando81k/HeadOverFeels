'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
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
            <h2 className="text-3xl lg:text-5xl font-bold mb-3 text-black tracking-tight uppercase">
              {name}
            </h2>
            <p className="text-base lg:text-lg text-gray-600 max-w-3xl">
              {description}
            </p>
          </div>
          <Link
            href={`/collections/${name.toLowerCase().replace(/\s+/g, '-')}`}
            className="hidden lg:inline-flex items-center gap-2 text-black hover:text-[#FF3131] transition-colors text-sm font-semibold uppercase tracking-wider"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-gray-500 text-sm uppercase tracking-wider">
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
                className="min-w-[240px] border-2 hover:bg-black hover:text-white hover:border-black transition-all duration-300"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-5 h-5 mr-2" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-5 h-5 mr-2" />
                    View {additionalProducts.length} More Products
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-3xl">
          <p className="text-gray-600 text-xl font-medium mb-2">No products in this collection yet</p>
          <p className="text-gray-500 text-sm">Check back soon for new drops!</p>
        </div>
      )}

      {/* Divider */}
      <div className="mt-16 border-t border-gray-200" />
    </section>
  )
}
