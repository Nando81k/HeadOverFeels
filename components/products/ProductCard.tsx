'use client'
import Image from 'next/image'
import Link from 'next/link'
import { Product } from '@/lib/api/products'

interface ProductCardProps {
  product: Product
  badge?: string // optional top-left badge text (e.g. "#1 Seller")
}

export function ProductCard({ product, badge }: ProductCardProps) {

  // Parse images JSON - handle both string and already-parsed array
  let imageUrl = '/placeholder-product.jpg'
  try {
    let images
    if (typeof product.images === 'string') {
      images = JSON.parse(product.images)
    } else {
      images = product.images
    }
    
    // Images are stored as a flat array of URLs, not objects with url property
    if (images && images.length > 0) {
      // Handle both string URLs and objects with url property
      imageUrl = typeof images[0] === 'string' ? images[0] : images[0].url
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
      <Link href={`/products/${product.slug}`} className="block">
        {/* Card Container - mirror BestSellers style */}
        <div className="group relative bg-white border border-black/10 overflow-hidden transition-all duration-300 h-full flex flex-col hover:border-black/30">
          {/* Image Container */}
          <div className="relative h-80 overflow-hidden bg-black/2">
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            />

            {/* Badges - Top Left */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              {badge && (
                <span className="px-3 py-1 bg-black text-white text-xs font-black rounded-none uppercase tracking-widest">
                  {badge}
                </span>
              )}
              {product.category && (
                <span className="px-3 py-1 bg-black/5 text-black/70 text-xs font-bold rounded-none uppercase border border-black/10">
                  {product.category.name}
                </span>
              )}
              {onSale && (
                <span className="px-3 py-1 bg-black text-white text-xs font-bold rounded-none uppercase tracking-widest">
                  Sale
                </span>
              )}
              {!inStock && (
                <span className="px-3 py-1 bg-black text-white text-xs font-bold rounded-none uppercase tracking-widest">
                  Sold Out
                </span>
              )}
            </div>
          </div>

          {/* Content - follow BestSellers ordering: title, short description, price */}
          <div className="p-6 flex-1 flex flex-col">
            <h3 className="text-lg md:text-xl font-black text-black mb-3 line-clamp-2">
              {product.name}
            </h3>

            {product.description && (
              <p className="text-xs md:text-sm text-black/60 mb-4 line-clamp-2 flex-1 font-medium">
                {product.description}
              </p>
            )}

            {/* Price Section */}
            <div className="flex items-baseline gap-3 mb-5">
              <span className="text-2xl font-black text-black">
                ${product.price.toFixed(2)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-sm text-black/40 line-through font-semibold">
                  ${product.compareAtPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Small CTA row to match BestSellers */}
            <div className="inline-flex items-center gap-1.5 text-black font-bold text-xs uppercase tracking-widest group-hover:gap-3 transition-all">
              <span>View</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
