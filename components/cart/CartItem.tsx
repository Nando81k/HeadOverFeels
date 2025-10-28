'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CartItem as CartItemType } from '@/lib/store/cart'
import { Trash2, Plus, Minus, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="flex gap-6 py-6 first:pt-0 group"
    >
      {/* Product Image */}
      <Link 
        href={`/products/${product.slug}`}
        className="relative w-28 h-28 rounded-xl overflow-hidden bg-gray-100 shrink-0 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105"
      >
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </Link>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between gap-4 mb-3">
          <div className="flex-1">
            <Link 
              href={`/products/${product.slug}`}
              className="font-bold text-lg text-gray-900 hover:text-[#FF3131] transition-colors line-clamp-2"
            >
              {product.name}
            </Link>
            <div className="flex flex-wrap gap-2 mt-2">
              {variant.size && (
                <span className="text-xs font-medium px-3 py-1 bg-gray-100 rounded-full text-gray-700">
                  Size: {variant.size}
                </span>
              )}
              {variant.color && (
                <span className="text-xs font-medium px-3 py-1 bg-gray-100 rounded-full text-gray-700">
                  Color: {variant.color}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-2 font-mono">
              SKU: {variant.sku}
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-xl text-[#FF3131] mb-1">
              ${subtotal.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">
              ${price.toFixed(2)} each
            </div>
          </div>
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onUpdateQuantity(product.id, variant.id, quantity - 1)}
              className="w-9 h-9 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:border-[#FF3131] hover:bg-[#FF3131]/5 transition-all duration-200 hover:scale-110 group/btn"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4 text-gray-700 group-hover/btn:text-[#FF3131]" />
            </button>
            <span className="w-14 text-center font-bold text-lg">{quantity}</span>
            <button
              onClick={() => onUpdateQuantity(product.id, variant.id, quantity + 1)}
              disabled={quantity >= variant.inventory}
              className="w-9 h-9 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:border-[#FF3131] hover:bg-[#FF3131]/5 transition-all duration-200 hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 group/btn"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4 text-gray-700 group-hover/btn:text-[#FF3131]" />
            </button>
          </div>

          {/* Remove Button */}
          <button
            onClick={() => onRemove(product.id, variant.id)}
            className="flex items-center gap-2 text-gray-600 hover:text-[#FF3131] font-semibold text-sm transition-all duration-200 hover:scale-105 group/del"
          >
            <Trash2 className="w-4 h-4 group-hover/del:scale-110 transition-transform" />
            Remove
          </button>
        </div>

        {/* Stock Warning */}
        {variant.inventory <= 5 && variant.inventory > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-2 text-xs font-semibold text-orange-600 bg-orange-50 px-3 py-2 rounded-lg border border-orange-200"
          >
            <AlertCircle className="w-4 h-4" />
            Only {variant.inventory} left in stock - Order soon!
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
