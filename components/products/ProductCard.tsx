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
  onProductClick?: () => void
}

export function ProductCard({ product, badge, onProductClick }: ProductCardProps) {
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
    <div className="group relative h-full">
      <Link href={`/products/${product.slug}`} onClick={onProductClick} className="block h-full">
        <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:shadow-[0_10px_20px_rgba(0,0,0,0.08)] active:scale-[0.99]">
          <div className="relative aspect-[5/6] overflow-hidden bg-black/[0.02]">
            <Image
              src={currentImage}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 45vw, (max-width: 768px) 45vw, (max-width: 1200px) 33vw, 25vw"
            />

            <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1">
              {badge && (
                <span className="rounded-full bg-black px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white">
                  {badge}
                </span>
              )}
              {onSale && (
                <span className="rounded-full bg-black px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white">
                  Save {Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)}%
                </span>
              )}
              {!inStock && (
                <span className="rounded-full border border-black/15 bg-white/95 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-black/70">
                  Sold Out
                </span>
              )}
            </div>

            {product.category && (
              <div className="absolute right-2.5 top-2.5 z-10">
                <span className="rounded-full border border-black/10 bg-white/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-black/65">
                  {product.category.name}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col p-3 sm:p-3.5">
            <h3 className="line-clamp-2 min-h-[2.45rem] text-sm font-semibold leading-tight text-black sm:text-[15px]">
              {product.name}
            </h3>

            {colorVariants.length > 1 && (
              <div
                className="mt-2.5 -mx-0.5 overflow-x-auto pb-1 scrollbar-hide [touch-action:pan-x]"
                onClick={(e) => e.preventDefault()}
                aria-label={`Available colors: ${colorVariants.map((variant) => variant.color).filter(Boolean).join(', ')}`}
              >
                <div className="flex w-max items-center gap-1.5 px-0.5">
                  {colorVariants.map((variant) => {
                    const isSelected = activeColor === variant.color
                    return (
                      <button
                        key={variant.id}
                        type="button"
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
                        aria-label={`Preview ${variant.color}`}
                        className={`
                          relative h-8 w-8 shrink-0 rounded-full border-2 transition-all
                          ${isSelected 
                            ? 'border-black ring-2 ring-black/35 ring-offset-1'
                            : 'border-black/20 hover:border-black/45'
                          }
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50 focus-visible:ring-offset-1
                        `}
                        style={{ backgroundColor: variant.colorHex || '#ccc' }}
                      >
                        {isSelected && variant.colorHex && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <Check 
                              className="h-3.5 w-3.5"
                              weight="bold"
                              style={{ color: isLightColor(variant.colorHex) ? '#000' : '#FFF' }} 
                            />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-base font-black text-black sm:text-lg">
                ${product.price.toFixed(2)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-xs font-medium text-black/40 line-through">
                  ${product.compareAtPrice.toFixed(2)}
                </span>
              )}
            </div>

            <div className="mt-auto pt-2.5">
              {!inStock ? (
                <p className="text-[11px] font-medium text-black/45">Currently unavailable</p>
              ) : (
                <p className="text-[11px] font-medium text-black/45">
                  {totalStock <= 5 ? `Only ${totalStock} left` : 'In stock'}
                </p>
              )}
            </div>
          </div>
        </article>
      </Link>
    </div>
  )
}
