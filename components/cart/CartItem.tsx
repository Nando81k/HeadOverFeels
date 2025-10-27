'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CartItem as CartItemType } from '@/lib/store/cart'
import { Trash2, Plus, Minus } from 'lucide-react'

interface CartItemProps {
  item: CartItemType
  onUpdateQuantity: (productId: string, variantId: string, quantity: number) => void
  onRemove: (productId: string, variantId: string) => void
}

export function CartItem({ item, onUpdateQuantity, onRemove }: CartItemProps) {
  const { product, variant, quantity } = item

  // Parse images
  let imageUrl = '/placeholder-product.jpg'
  try {
    const images = JSON.parse(product.images)
    if (images && images.length > 0 && images[0].url) {
      imageUrl = images[0].url || '/placeholder-product.jpg'
    }
  } catch {
    // Use placeholder
  }
  
  // Ensure we never have an empty string
  if (!imageUrl || imageUrl.trim() === '') {
    imageUrl = '/placeholder-product.jpg'
  }

  const price = variant.price || product.price
  const subtotal = price * quantity

  return (
    <div className="flex gap-4 py-6 border-b border-gray-200">
      {/* Product Image */}
      <Link 
        href={`/products/${product.slug}`}
        className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100 shrink-0"
      >
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          className="object-cover"
        />
      </Link>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-2">
          <div>
            <Link 
              href={`/products/${product.slug}`}
              className="font-semibold text-gray-900 hover:text-gray-600 transition-colors"
            >
              {product.name}
            </Link>
            <div className="text-sm text-gray-500 mt-1">
              {variant.size && <span>Size: {variant.size}</span>}
              {variant.size && variant.color && <span className="mx-2">•</span>}
              {variant.color && <span>Color: {variant.color}</span>}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              SKU: {variant.sku}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-gray-900">
              ${subtotal.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">
              ${price.toFixed(2)} each
            </div>
          </div>
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateQuantity(product.id, variant.id, quantity - 1)}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-12 text-center font-medium">{quantity}</span>
            <button
              onClick={() => onUpdateQuantity(product.id, variant.id, quantity + 1)}
              disabled={quantity >= variant.inventory}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Remove Button */}
          <button
            onClick={() => onRemove(product.id, variant.id)}
            className="text-red-600 hover:text-red-700 flex items-center gap-1 text-sm transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </button>
        </div>

        {/* Stock Warning */}
        {variant.inventory <= 5 && variant.inventory > 0 && (
          <div className="mt-2 text-xs text-orange-600">
            Only {variant.inventory} left in stock
          </div>
        )}
      </div>
    </div>
  )
}
