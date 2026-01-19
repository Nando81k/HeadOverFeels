'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Product } from '@/lib/api/products'
import { Check } from '@phosphor-icons/react'

// Helper function to determine if color is light (for contrast)
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

interface ProductCardProps {
  product: Product
  badge?: string
}

export function ProductCard({ product, badge }: ProductCardProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null)

  // Get unique colors with their variants (one per color)
  const colorVariants = useMemo(() => {
    const seenColors = new Set<string>()
    return product.variants.filter(v => {
      if (v.color && v.colorHex && !seenColors.has(v.color)) {
        seenColors.add(v.color)
        return true
      }
      return false
    })
  }, [product.variants])

  // Parse images from string to array
  const parseImages = (imagesStr: string | undefined): string[] => {
    if (!imagesStr) return []
    try {
      const parsed = JSON.parse(imagesStr)
      if (Array.isArray(parsed)) {
        return parsed.map((img: string | { url: string }) => 
          typeof img === 'string' ? img : img.url
        ).filter((url: string) => url && url.trim() !== '')
      }
    } catch {
      // Parse failed
    }
    return []
  }

  // Get the current image based on selected color
  const currentImage = useMemo(() => {
    // If a color is selected, use that variant's first image
    if (selectedColor) {
      const variant = colorVariants.find(v => v.color === selectedColor)
      if (variant?.images) {
        const variantImages = parseImages(variant.images)
        if (variantImages.length > 0) return variantImages[0]
      }
    }
    
    // Fall back to first product image
    const productImages = parseImages(product.images)
    if (productImages.length > 0) return productImages[0]
    
    return '/placeholder-product.jpg'
  }, [selectedColor, colorVariants, product.images])

  // Check if on sale
  const onSale = product.compareAtPrice && product.compareAtPrice > product.price

  // Check stock status
  const totalStock = product.variants.reduce((sum, v) => sum + v.inventory, 0)
  const inStock = totalStock > 0

  return (
    <div className="group relative">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="bg-white border border-black/10 overflow-hidden transition-all duration-300 h-full flex flex-col hover:border-black/30 active:scale-[0.98]">
          {/* Image Container */}
          <div className="relative aspect-square overflow-hidden bg-black/2">
            <Image
              src={currentImage}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            />

            {/* Badges - Top Left */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
              {badge && (
                <span className="px-3 py-1 bg-black text-white text-xs font-black uppercase tracking-widest">
                  {badge}
                </span>
              )}
              {onSale && (
                <span className="px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-widest">
                  Sale
                </span>
              )}
              {!inStock && (
                <span className="px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-widest">
                  Sold Out
                </span>
              )}
            </div>

            {/* Category Badge - Top Right */}
            {product.category && (
              <div className="absolute top-4 right-4 z-10">
                <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-black/70 text-xs font-bold uppercase border border-black/10">
                  {product.category.name}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 flex-1 flex flex-col">
            {/* Title */}
            <h3 className="text-base sm:text-lg font-black text-black mb-2 line-clamp-2 tracking-tight">
              {product.name}
            </h3>

            {/* Description - Hidden on mobile */}
            {product.description && (
              <p className="text-sm text-black/60 mb-3 line-clamp-2 flex-1 font-medium hidden sm:block">
                {product.description}
              </p>
            )}

            {/* Color Swatches */}
            {colorVariants.length > 1 && (
              <div 
                className="flex flex-wrap gap-2 mb-4"
                onClick={(e) => e.preventDefault()}
              >
                {colorVariants.slice(0, 6).map((variant) => {
                  const isSelected = selectedColor === variant.color
                  return (
                    <button
                      key={variant.id}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSelectedColor(isSelected ? null : variant.color || null)
                      }}
                      title={variant.color || undefined}
                      className={`
                        relative w-7 h-7 border-2 transition-all
                        ${isSelected 
                          ? 'border-black scale-110 ring-2 ring-black ring-offset-2' 
                          : 'border-black/20 hover:border-black/50 hover:scale-105'
                        }
                      `}
                      style={{ backgroundColor: variant.colorHex || '#ccc' }}
                    >
                      {isSelected && variant.colorHex && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check 
                            className="w-3.5 h-3.5" 
                            weight="bold"
                            style={{ color: isLightColor(variant.colorHex) ? '#000' : '#FFF' }} 
                          />
                        </span>
                      )}
                    </button>
                  )
                })}
                {colorVariants.length > 6 && (
                  <span className="text-xs text-black/50 self-center ml-1 font-medium">
                    +{colorVariants.length - 6}
                  </span>
                )}
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-xl sm:text-2xl font-black text-black">
                ${product.price.toFixed(2)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-sm text-black/40 line-through font-semibold">
                  ${product.compareAtPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* CTA */}
            <div className="mt-auto">
              <span className="inline-flex items-center gap-2 text-black font-bold text-xs uppercase tracking-widest group-hover:gap-3 transition-all">
                View Product
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
