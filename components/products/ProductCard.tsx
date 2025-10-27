'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Product } from '@/lib/api/products'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)

  // Parse images JSON - handle both string and already-parsed array
  let imageUrl = '/placeholder-product.jpg'
  try {
    let images
    if (typeof product.images === 'string') {
      images = JSON.parse(product.images)
    } else {
      images = product.images
    }
    
    if (images && images.length > 0 && images[0].url) {
      imageUrl = images[0].url
    }
  } catch {
    // Use placeholder if parsing fails
  }

  // Ensure imageUrl is never empty
  if (!imageUrl || imageUrl.trim() === '') {
    imageUrl = '/placeholder-product.jpg'
  }

  // Check if on sale
  const onSale = product.compareAtPrice && product.compareAtPrice > product.price

  // Check stock status
  const totalStock = product.variants.reduce((sum, v) => sum + v.inventory, 0)
  const inStock = totalStock > 0

  return (
    <div className="group relative">
      <Link 
        href={`/products/${product.slug}`}
        className="block"
      >
        {/* Product Image */}
        <div className="relative aspect-3/4 overflow-hidden rounded-xl bg-[#F5F1EB] mb-3">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className={`object-cover transition-all duration-500 group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
          />
          
          {/* Badges - Top Left Only */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {onSale && (
              <span className="bg-[#E74C3C] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Sale
              </span>
            )}
            {!inStock && (
              <span className="bg-[#2B2B2B] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Sold Out
              </span>
            )}
            {product.isLimitedEdition && inStock && (
              <span className="bg-[#8B7355] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Limited
              </span>
            )}
          </div>
        </div>

        {/* Product Info - Minimal Comfrt Style */}
        <div className="space-y-1.5">
          <h3 className="font-medium text-[#2B2B2B] text-sm tracking-tight leading-tight group-hover:text-[#6B6B6B] transition-colors">
            {product.name}
          </h3>
          
          <div className="flex items-baseline gap-2">
            {onSale ? (
              <>
                <span className="text-[#2B2B2B] font-semibold text-base">
                  ${product.price.toFixed(2)}
                </span>
                <span className="text-[#9B9B9B] line-through text-sm">
                  ${product.compareAtPrice?.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="text-[#2B2B2B] font-semibold text-base">
                From ${product.price.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}
