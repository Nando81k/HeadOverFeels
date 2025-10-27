'use client'

import { useState } from 'react'
import { ProductVariant } from '@/lib/api/products'
import { Check } from 'lucide-react'

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

export function VariantSelector({ variants, onVariantChange }: VariantSelectorProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    variants.find(v => v.inventory > 0) || variants[0] || null
  )

  // Group variants by size and color
  const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))]
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
            <label className="text-sm font-medium text-gray-900">Size</label>
            {selectedSize && selectedVariant && (
              <span className="text-sm text-gray-500">
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
                    relative px-4 py-3 text-sm font-medium rounded-lg border-2 transition-all
                    ${isSelected 
                      ? 'border-black bg-black text-white' 
                      : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'
                    }
                    ${!isAvailable || !inStock 
                      ? 'opacity-40 cursor-not-allowed' 
                      : 'cursor-pointer'
                    }
                  `}
                >
                  {size}
                  {isSelected && (
                    <Check className="absolute top-1 right-1 w-4 h-4" />
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
          <label className="block text-sm font-medium text-gray-900 mb-3">
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
                    relative w-12 h-12 rounded-full border-4 transition-all
                    ${isSelected 
                      ? 'border-black scale-110' 
                      : 'border-gray-300 hover:border-gray-400'
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
                    px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all
                    ${isSelected 
                      ? 'border-black bg-black text-white' 
                      : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'
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
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">SKU:</span>
            <span className="font-mono text-gray-900">{selectedVariant.sku}</span>
          </div>
          {selectedVariant.price && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-600">Variant Price:</span>
              <span className="font-semibold text-gray-900">
                ${selectedVariant.price.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
