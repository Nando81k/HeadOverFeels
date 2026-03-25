'use client'

import { ShoppingCart, Check, Minus, Plus, Bag } from '@phosphor-icons/react'
import { ProductVariant } from '@/lib/api/products'
import { useCartStore } from '@/lib/store/cart'
import Link from 'next/link'

interface MobileAddToCartBarProps {
  price: number
  inStock: boolean
  selectedVariant: ProductVariant | null
  quantity: number
  maxQuantity: number
  stockStatusLabel: string
  onQuantityChange: (quantity: number) => void
  onAddToCart: () => void
  showAddedMessage: boolean
}

export function MobileAddToCartBar({
  price,
  inStock,
  selectedVariant,
  quantity,
  maxQuantity,
  stockStatusLabel,
  onQuantityChange,
  onAddToCart,
  showAddedMessage
}: MobileAddToCartBarProps) {
  // Get cart item count
  const cartItemCount = useCartStore((state) => state.getTotalItems())

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the bar */}
      <div className="h-24 lg:hidden" aria-hidden="true" />
      
      {/* Sticky bar - only visible on mobile */}
      <div
        className="fixed bottom-0 left-0 right-0 z-10000 lg:hidden bg-white border-t border-black/10 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Price & Variant Info */}
          <div className="flex flex-col min-w-0 shrink-0">
            <span className="text-lg font-black text-black">
              ${price.toFixed(2)}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/70 truncate max-w-[110px]">
              {(selectedVariant?.color || 'N/A').toUpperCase()} • {(selectedVariant?.size || 'N/A').toUpperCase()}
            </span>
            <span className="text-[10px] text-black/50 truncate max-w-[110px]">
              {stockStatusLabel}
            </span>
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center h-10 border border-black/10 rounded-lg overflow-hidden shrink-0">
            <button
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              disabled={quantity <= 1 || maxQuantity <= 0}
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
              disabled={maxQuantity <= 0 || quantity >= maxQuantity}
              className="w-9 h-full flex items-center justify-center bg-black/5 active:bg-black/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-black text-white text-[10px] font-bold rounded-full px-1">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </>
  )
}
