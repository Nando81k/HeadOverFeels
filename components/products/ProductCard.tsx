'use client'
import { useState, useEffect, useMemo } from 'react'
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
  badge?: string // optional top-left badge text (e.g. "#1 Seller")
}

export function ProductCard({ product, badge }: ProductCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [isHoveringCard, setIsHoveringCard] = useState(false)

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

  // Get images based on selected color variant or fall back to product images
  const images = useMemo(() => {
    // If a color is selected, use that variant's images
    if (selectedColor) {
      const variant = colorVariants.find(v => v.color === selectedColor)
      if (variant?.images) {
        const variantImages = parseImages(variant.images)
        if (variantImages.length > 0) return variantImages
      }
    }
    
    // Fall back to product images
    const productImages = parseImages(product.images)
    if (productImages.length > 0) return productImages
    
    return ['/placeholder-product.jpg']
  }, [selectedColor, colorVariants, product.images])

  // Handle color selection and reset image index
  const handleColorSelect = (color: string | null) => {
    if (color !== selectedColor) {
      setCurrentImageIndex(0)
      setSelectedColor(color)
    }
  }

  // Cycle through images every 3.5 seconds if there are multiple and hovering card
  useEffect(() => {
    if (images.length <= 1 || !isHoveringCard) return

    const interval = setInterval(() => {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length)
        setIsTransitioning(false)
      }, 300) // Fade out duration
    }, 3500) // Change image every 3.5 seconds

    return () => clearInterval(interval)
  }, [images.length, isHoveringCard])

  const currentImage = images[currentImageIndex] || '/placeholder-product.jpg'

  // Check if on sale
  const onSale = product.compareAtPrice && product.compareAtPrice > product.price

  // Check stock status
  const totalStock = product.variants.reduce((sum, v) => sum + v.inventory, 0)
  const inStock = totalStock > 0

  return (
    <div 
      className="group relative"
      onMouseEnter={() => setIsHoveringCard(true)}
      onMouseLeave={() => setIsHoveringCard(false)}
    >
      <Link href={`/products/${product.slug}`} className="block">
        {/* Card Container - mirror BestSellers style */}
        <div className="group relative bg-white border border-black/10 overflow-hidden transition-all duration-300 h-full flex flex-col hover:border-black/30 active:scale-[0.98]">
          {/* Image Container - taller on mobile for better visuals */}
          <div className="relative h-64 sm:h-80 overflow-hidden bg-black/2">
            <Image
              src={currentImage}
              alt={product.name}
              fill
              className={`object-cover transition-all duration-500 group-hover:scale-105 ${
                isTransitioning ? 'opacity-0' : 'opacity-100'
              }`}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            />

            {/* Image indicators - only show if multiple images */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {images.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentImageIndex 
                        ? 'bg-black w-4' 
                        : 'bg-black/30'
                    }`}
                  />
                ))}
              </div>
            )}

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
          <div className="p-4 sm:p-6 flex-1 flex flex-col">
            <h3 className="text-base sm:text-lg md:text-xl font-black text-black mb-2 sm:mb-3 line-clamp-2">
              {product.name}
            </h3>

            {product.description && (
              <p className="text-xs sm:text-sm text-black/60 mb-3 sm:mb-4 line-clamp-2 flex-1 font-medium hidden sm:block">
                {product.description}
              </p>
            )}

            {/* Color Swatches - show available colors */}
            {colorVariants.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {colorVariants.slice(0, 5).map((variant) => {
                  const isSelected = selectedColor === variant.color
                  return (
                    <button
                      key={variant.id}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleColorSelect(isSelected ? null : variant.color || null)
                      }}
                      onMouseEnter={(e) => {
                        e.preventDefault()
                        handleColorSelect(variant.color || null)
                      }}
                      onMouseLeave={(e) => {
                        e.preventDefault()
                        if (!isSelected) handleColorSelect(null)
                      }}
                      title={variant.color || undefined}
                      className={`
                        relative w-6 h-6 rounded-full border transition-all
                        ${isSelected 
                          ? 'border-black scale-110 ring-1 ring-black ring-offset-1' 
                          : 'border-black/20 hover:border-black/40 hover:scale-105'
                        }
                      `}
                      style={{ backgroundColor: variant.colorHex || '#ccc' }}
                    >
                      {isSelected && variant.colorHex && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check className="w-3 h-3" style={{ 
                            color: isLightColor(variant.colorHex) ? '#000' : '#FFF'
                          }} />
                        </span>
                      )}
                    </button>
                  )
                })}
                {colorVariants.length > 5 && (
                  <span className="text-xs text-black/50 self-center ml-1">
                    +{colorVariants.length - 5}
                  </span>
                )}
              </div>
            )}

            {/* Price Section */}
            <div className="flex items-baseline gap-2 sm:gap-3 mb-3 sm:mb-5">
              <span className="text-lg sm:text-2xl font-black text-black">
                ${product.price.toFixed(2)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-xs sm:text-sm text-black/40 line-through font-semibold">
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
