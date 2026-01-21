'use client'

import { useState } from 'react'
import { ProductVariant } from '@/lib/api/products'
import { Check } from '@phosphor-icons/react'

// Helper function to determine if color is light (for contrast)
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

interface VariantSelectorProps {
  variants: ProductVariant[]
  onVariantChange: (variant: ProductVariant) => void
}

// Size order for proper sorting (S to XL, then numeric)
// Standard clothing sizes get explicit ordering, numeric sizes use fallback sorting
const sizeOrder: Record<string, number> = {
  'XXS': 0, 'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5, 'XXL': 6, '2XL': 6, 'XXXL': 7, '3XL': 7,
  'ONE SIZE': 100, 'OS': 100, 'ONESIZE': 100
}

// Helper to sort sizes - handles letter sizes via sizeOrder, numeric sizes via parseFloat
function sortSizes(a: string, b: string): number {
  const upperA = a.toUpperCase()
  const upperB = b.toUpperCase()
  const orderA = sizeOrder[upperA]
  const orderB = sizeOrder[upperB]
  
  // Both have explicit order
  if (orderA !== undefined && orderB !== undefined) return orderA - orderB
  // Only A has explicit order - A comes first
  if (orderA !== undefined) return -1
  // Only B has explicit order - B comes first
  if (orderB !== undefined) return 1
  
  // Try numeric comparison for both
  const numA = parseFloat(a)
  const numB = parseFloat(b)
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB
  
  // Fallback to string comparison
  return a.localeCompare(b)
}

export function VariantSelector({ variants, onVariantChange }: VariantSelectorProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    variants.find(v => v.inventory > 0) || variants[0] || null
  )

  // Group variants by size and color, sorted properly
  const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))].sort((a, b) => sortSizes(a!, b!))
  const colors = [...new Set(variants.map(v => v.color).filter(Boolean))]

  const [selectedSize, setSelectedSize] = useState<string | null>(
    selectedVariant?.size || sizes[0] || null
  )
  const [selectedColor, setSelectedColor] = useState<string | null>(
    selectedVariant?.color || colors[0] || null
  )

  const handleSizeChange = (size: string) => {
    setSelectedSize(size)
    const variant = variants.find(
      v => v.size === size && (!selectedColor || v.color === selectedColor)
    )
    if (variant) {
      setSelectedVariant(variant)
      onVariantChange(variant)
    }
  }

  const handleColorChange = (color: string) => {
    setSelectedColor(color)
    const variant = variants.find(
      v => v.color === color && (!selectedSize || v.size === selectedSize)
    )
    if (variant) {
      setSelectedVariant(variant)
      onVariantChange(variant)
    }
  }

  // Get available sizes for selected color
  const availableSizes = selectedColor
    ? variants.filter(v => v.color === selectedColor).map(v => v.size)
    : sizes

  // Get available colors for selected size
  const availableColors = selectedSize
    ? variants.filter(v => v.size === selectedSize).map(v => v.color)
    : colors

  return (
    <div className="space-y-6">
      {/* Size Selection */}
      {sizes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-bold text-black">Size</label>
            {selectedSize && selectedVariant && (
              <span className="text-sm text-black/60">
                {selectedVariant.inventory > 0 
                  ? `${selectedVariant.inventory} in stock`
                  : 'Out of stock'
                }
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {sizes.map((size) => {
              const variant = variants.find(
                v => v.size === size && (!selectedColor || v.color === selectedColor)
              )
              const isAvailable = availableSizes.includes(size)
              const inStock = variant && variant.inventory > 0
              const isSelected = selectedSize === size

              return (
                <button
                  key={size}
                  onClick={() => handleSizeChange(size!)}
                  disabled={!isAvailable || !inStock}
                  className={`
                    relative px-4 py-3 text-sm font-bold rounded-none border transition-all
                    ${isSelected 
                      ? 'border-black bg-black text-white' 
                      : 'border-black/10 bg-white text-black hover:border-black/20'
                    }
                    ${!isAvailable || !inStock 
                      ? 'opacity-40 cursor-not-allowed' 
                      : 'cursor-pointer'
                    }
                  `}
                >
                  {size}
                  {isSelected && (
                    <Check size={16} weight="bold" className="absolute top-1 right-1" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Color Selection */}
      {colors.length > 0 && (
        <div>
          <label className="block text-sm font-bold text-black mb-3">
            Color {selectedColor && `- ${selectedColor}`}
          </label>
          <div className="flex flex-wrap gap-3">
            {colors.map((color) => {
              const variant = variants.find(v => v.color === color)
              const isAvailable = availableColors.includes(color)
              const isSelected = selectedColor === color
              const hasColorHex = variant?.colorHex && variant.colorHex.match(/^#[0-9A-Fa-f]{6}$/)

              return hasColorHex ? (
                // Color swatch button
                <button
                  key={color}
                  onClick={() => handleColorChange(color!)}
                  disabled={!isAvailable}
                  title={color || undefined}
                  className={`
                    relative w-12 h-12 rounded-none border-2 transition-all
                    ${isSelected 
                      ? 'border-black scale-110' 
                      : 'border-black/20 hover:border-black/40'
                    }
                    ${!isAvailable 
                      ? 'opacity-40 cursor-not-allowed' 
                      : 'cursor-pointer'
                    }
                  `}
                  style={{ backgroundColor: variant.colorHex }}
                >
                  {isSelected && variant.colorHex && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-5 h-5 drop-shadow-lg" style={{ 
                        color: isLightColor(variant.colorHex) ? '#000' : '#FFF'
                      }} />
                    </span>
                  )}
                </button>
              ) : (
                // Fallback text button
                <button
                  key={color}
                  onClick={() => handleColorChange(color!)}
                  disabled={!isAvailable}
                  className={`
                    px-4 py-2 text-sm font-bold rounded-none border transition-all
                    ${isSelected 
                      ? 'border-black bg-black text-white' 
                      : 'border-black/10 bg-white text-black hover:border-black/20'
                    }
                    ${!isAvailable 
                      ? 'opacity-40 cursor-not-allowed' 
                      : 'cursor-pointer'
                    }
                  `}
                >
                  {color}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Selected Variant Info */}
      {selectedVariant && (
        <div className="pt-4 border-t border-black/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-black/60">SKU:</span>
            <span className="font-mono text-black">{selectedVariant.sku}</span>
          </div>
          {selectedVariant.price && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-black/60">Variant Price:</span>
              <span className="font-bold text-black">
                ${selectedVariant.price.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
