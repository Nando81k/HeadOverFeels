'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Product } from '@/lib/api/products'
import { Check } from '@phosphor-icons/react'
import { getPrimaryImageWithFallback, parseImageList } from '@/lib/commerce/product-placeholders'

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
  const [previewColor, setPreviewColor] = useState<string | null>(null)
  const activeColor = previewColor ?? selectedColor

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

  // Get the current image based on selected color
  const currentImage = useMemo(() => {
    // If a color is selected, use that variant's first image
    if (activeColor) {
      const variant = colorVariants.find(v => v.color === activeColor)
      if (variant) {
        const variantImages = parseImageList(variant.images)
        if (variantImages.length > 0) {
          return variantImages[0]
        }

        return getPrimaryImageWithFallback({
          images: '',
          productName: product.name,
          productSlug: product.slug,
          color: variant.color,
          colorHex: variant.colorHex,
          size: variant.size,
        })
      }
    }

    return getPrimaryImageWithFallback({
      images: product.images,
      productName: product.name,
      productSlug: product.slug,
    })
  }, [activeColor, colorVariants, product.images, product.name, product.slug])

  // Check if on sale
  const onSale = product.compareAtPrice && product.compareAtPrice > product.price

  // Check stock status
  const totalStock = product.variants.reduce((sum, v) => sum + v.inventory, 0)
  const inStock = totalStock > 0

  return (
    <div className="group relative">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="bg-white border border-black/10 overflow-hidden transition-all duration-300 h-full flex flex-col hover:border-black/30 active:scale-[0.98]">
          {/* Image Container - More compact on mobile */}
          <div className="relative aspect-[4/5] overflow-hidden bg-black/2">
            <Image
              src={currentImage}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 45vw, (max-width: 768px) 45vw, (max-width: 1200px) 33vw, 25vw"
            />

            {/* Badges - Top Left - Smaller on mobile */}
            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 flex flex-col gap-1 sm:gap-2">
              {badge && (
                <span className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-black text-white text-[8px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest">
                  {badge}
                </span>
              )}
              {onSale && (
                <span className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-black text-white text-[8px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest">
                  Sale
                </span>
              )}
              {!inStock && (
                <span className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-black text-white text-[8px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest">
                  Sold Out
                </span>
              )}
            </div>

            {/* Category Badge - Top Right - Hidden on very small screens */}
            {product.category && (
              <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 hidden xs:block">
                <span className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-white/90 backdrop-blur-sm text-black/70 text-[8px] sm:text-xs font-bold uppercase border border-black/10">
                  {product.category.name}
                </span>
              </div>
            )}
          </div>

          {/* Content - More compact on mobile */}
          <div className="p-2.5 sm:p-4 flex-1 flex flex-col">
            {/* Title */}
            <h3 className="text-xs sm:text-base font-bold sm:font-black text-black mb-1 sm:mb-2 line-clamp-2 tracking-tight leading-tight">
              {product.name}
            </h3>

            {/* Description - Hidden on mobile */}
            {product.description && (
              <p className="text-sm text-black/60 mb-3 line-clamp-2 flex-1 font-medium hidden md:block">
                {product.description}
              </p>
            )}

            {/* Color Swatches - Smaller on mobile */}
            {colorVariants.length > 1 && (
              <div 
                className="flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-4"
                onClick={(e) => e.preventDefault()}
              >
                {colorVariants.slice(0, 4).map((variant) => {
                  const isSelected = activeColor === variant.color
                  return (
                    <button
                      key={variant.id}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSelectedColor(isSelected ? null : variant.color || null)
                      }}
                      onMouseEnter={() => setPreviewColor(variant.color || null)}
                      onMouseLeave={() => setPreviewColor(null)}
                      onFocus={() => setPreviewColor(variant.color || null)}
                      onBlur={() => setPreviewColor(null)}
                      title={variant.color || undefined}
                      className={`
                        relative w-5 h-5 sm:w-7 sm:h-7 border-2 transition-all
                        ${isSelected 
                          ? 'border-black scale-110 ring-1 sm:ring-2 ring-black ring-offset-1 sm:ring-offset-2' 
                          : 'border-black/20 hover:border-black/50 hover:scale-105'
                        }
                      `}
                      style={{ backgroundColor: variant.colorHex || '#ccc' }}
                    >
                      {isSelected && variant.colorHex && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check 
                            className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" 
                            weight="bold"
                            style={{ color: isLightColor(variant.colorHex) ? '#000' : '#FFF' }} 
                          />
                        </span>
                      )}
                    </button>
                  )
                })}
                {colorVariants.length > 4 && (
                  <span className="text-[10px] sm:text-xs text-black/50 self-center ml-0.5 font-medium">
                    +{colorVariants.length - 4}
                  </span>
                )}
              </div>
            )}

            {/* Price - Compact on mobile */}
            <div className="flex items-baseline gap-1.5 sm:gap-3 mb-1 sm:mb-4">
              <span className="text-sm sm:text-xl font-black text-black">
                ${product.price.toFixed(2)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-[10px] sm:text-sm text-black/40 line-through font-semibold">
                  ${product.compareAtPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* CTA - Hidden on mobile for cleaner look */}
            <div className="mt-auto hidden sm:block">
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
