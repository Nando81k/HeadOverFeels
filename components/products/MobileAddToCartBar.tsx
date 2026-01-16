'use client'

import { useState } from 'react'
import { ShoppingCart, Check, Minus, Plus } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { ProductVariant } from '@/lib/api/products'

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
  const [showQuantity, setShowQuantity] = useState(false)
  const onSale = compareAtPrice && compareAtPrice > price

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the bar */}
      <div className="h-20 lg:hidden" />
      
      {/* Sticky bar - only visible on mobile */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white border-t border-black/10 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {/* Price */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-black">
                ${price.toFixed(2)}
              </span>
              {onSale && (
                <span className="text-sm text-black/40 line-through">
                  ${compareAtPrice?.toFixed(2)}
                </span>
              )}
            </div>
            {selectedVariant && (
              <span className="text-xs text-black/50">
                {selectedVariant.size && `Size: ${selectedVariant.size}`}
                {selectedVariant.size && selectedVariant.color && ' · '}
                {selectedVariant.color && `${selectedVariant.color}`}
              </span>
            )}
          </div>

          {/* Quantity & Add to Cart */}
          <div className="flex items-center gap-2">
            {/* Quantity Selector */}
            <AnimatePresence>
              {showQuantity && (
                <motion.div 
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="flex items-center overflow-hidden"
                >
                  <button
                    onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                    className="w-10 h-10 flex items-center justify-center bg-black/5 active:bg-black/10 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={16} weight="bold" />
                  </button>
                  <span className="w-10 h-10 flex items-center justify-center text-sm font-bold">
                    {quantity}
                  </span>
                  <button
                    onClick={() => onQuantityChange(quantity + 1)}
                    className="w-10 h-10 flex items-center justify-center bg-black/5 active:bg-black/10 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus size={16} weight="bold" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Toggle Quantity Button */}
            <button
              onClick={() => setShowQuantity(!showQuantity)}
              className="w-10 h-10 flex items-center justify-center border border-black/10 text-black/60"
              aria-label={showQuantity ? 'Hide quantity' : 'Show quantity'}
            >
              {quantity}
            </button>

            {/* Add to Cart Button */}
            <button
              onClick={onAddToCart}
              disabled={!inStock || !selectedVariant}
              className={`flex items-center justify-center gap-2 px-6 h-12 font-bold text-sm transition-all ${
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
                  <span>{inStock ? 'Add' : 'Sold Out'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}
