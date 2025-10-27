'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ProductCard } from '@/components/products/ProductCard'
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
  imageUrl,
  products,
  defaultExpanded = false
}: CollectionPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  // Show 3 products in preview, all when expanded
  const previewProducts = products.slice(0, 3)
  const additionalProducts = products.slice(3)
  const hasMore = additionalProducts.length > 0

  return (
    <div className="mb-16 last:mb-0">
      {/* Collection Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div className="flex-1">
            <h2 className="text-3xl lg:text-4xl font-bold mb-3 text-[#1A1A1A] tracking-tight uppercase">
              {name}
            </h2>
            <p className="text-lg text-[#6B6B6B] leading-relaxed max-w-2xl">
              {description}
            </p>
            <div className="mt-4 text-sm text-[#6B6B6B]">
              {products.length} {products.length === 1 ? 'product' : 'products'}
            </div>
          </div>
          
          {/* Collection Image */}
          {imageUrl && (
            <div className="hidden md:block w-48 h-48 rounded-2xl overflow-hidden bg-[#F5F1EB] relative">
              <Image
                src={imageUrl}
                alt={name}
                fill
                className="object-cover"
              />
            </div>
          )}
        </div>
      </div>

      {/* Products Grid - Preview */}
      {products.length > 0 ? (
        <>
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {previewProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Expanded Products */}
          {isExpanded && hasMore && (
            <div className="grid md:grid-cols-3 gap-8 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
              {additionalProducts.map(product => (
                <ProductCard key={product.id} product={product} />
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
                className="min-w-[200px]"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-5 h-5 mr-2" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-5 h-5 mr-2" />
                    View {additionalProducts.length} More
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-[#F5F1EB] rounded-2xl">
          <p className="text-[#6B6B6B] text-lg">No products in this collection yet</p>
          <p className="text-[#6B6B6B] text-sm mt-2">Check back soon for new drops!</p>
        </div>
      )}

      {/* Divider */}
      <div className="mt-12 border-t border-[#E5DDD5]" />
    </div>
  )
}
