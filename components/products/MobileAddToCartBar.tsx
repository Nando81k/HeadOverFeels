'use client'

import { useState, useEffect } from 'react'
import { ShoppingCart, Check, Minus, Plus, Bag } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { ProductVariant } from '@/lib/api/products'
import { useCartStore } from '@/lib/store/cart'
import Link from 'next/link'

interface MobileAddToCartBarProps {
  price: number
  compareAtPrice?: number | null
  inStock: boolean
  selectedVariant: ProductVariant | null
  quantity: number
  onQuantityChange: (quantity: number) => void
  onAddToCart: () => void
  showAddedMessage: boolean
}

export function MobileAddToCartBar({
  price,
  compareAtPrice,
  inStock,
  selectedVariant,
  quantity,
  onQuantityChange,
  onAddToCart,
  showAddedMessage
}: MobileAddToCartBarProps) {
  const [mounted, setMounted] = useState(false)
  const onSale = compareAtPrice && compareAtPrice > price
  
  // Get cart item count
  const cartItemCount = useCartStore(state => mounted ? state.getTotalItems() : 0)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the bar */}
      <div className="h-24 lg:hidden" aria-hidden="true" />
      
      {/* Sticky bar - only visible on mobile */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-10000 lg:hidden bg-white border-t border-black/10 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          position: 'fixed',
          transform: 'translateZ(0)',
          willChange: 'transform',
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Price & Variant Info */}
          <div className="flex flex-col min-w-0 shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-black">
                ${price.toFixed(2)}
              </span>
              {onSale && (
                <span className="text-xs text-black/40 line-through">
                  ${compareAtPrice?.toFixed(2)}
                </span>
              )}
            </div>
            {selectedVariant && (
              <span className="text-[10px] text-black/50 truncate">
                {selectedVariant.size && `${selectedVariant.size}`}
                {selectedVariant.size && selectedVariant.color && ' · '}
                {selectedVariant.color && `${selectedVariant.color}`}
              </span>
            )}
          </div>

          {/* Quantity Selector - Always visible, compact design */}
          <div className="flex items-center h-10 border border-black/10 rounded-lg overflow-hidden shrink-0">
            <button
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-9 h-full flex items-center justify-center bg-black/5 active:bg-black/10 transition-colors disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus size={14} weight="bold" />
            </button>
            <span className="w-8 h-full flex items-center justify-center text-sm font-bold bg-white">
              {quantity}
            </span>
            <button
              onClick={() => onQuantityChange(quantity + 1)}
              className="w-9 h-full flex items-center justify-center bg-black/5 active:bg-black/10 transition-colors"
              aria-label="Increase quantity"
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>

          {/* Add to Cart Button - Grows to fill space */}
          <button
            onClick={onAddToCart}
            disabled={!inStock || !selectedVariant}
            className={`flex-1 flex items-center justify-center gap-2 h-11 font-bold text-sm rounded-lg transition-all ${
              !inStock || !selectedVariant
                ? 'bg-black/20 text-black/40 cursor-not-allowed'
                : 'bg-black text-white active:scale-[0.98]'
            }`}
          >
            {showAddedMessage ? (
              <>
                <Check size={18} weight="bold" />
                <span>Added!</span>
              </>
            ) : (
              <>
                <ShoppingCart size={18} weight="bold" />
                <span>{inStock ? 'Add to Cart' : 'Sold Out'}</span>
              </>
            )}
          </button>

          {/* View Cart Button */}
          <Link
            href="/cart"
            className="relative flex items-center justify-center w-11 h-11 bg-black/5 active:bg-black/10 rounded-lg transition-colors shrink-0"
            aria-label="View cart"
          >
            <Bag size={20} weight="bold" className="text-black" />
            {mounted && cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-black text-white text-[10px] font-bold rounded-full px-1">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
          </Link>
        </div>
      </motion.div>
    </>
  )
}
