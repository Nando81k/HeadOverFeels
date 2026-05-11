'use client'

import { useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore, type CartItem } from '@/lib/store/cart'
import { FreeShippingProgress } from './FreeShippingProgress'
import { getPrimaryImageWithFallback } from '@/lib/commerce/product-placeholders'
import { X, Minus, Plus, Bag, ArrowRight, Trash } from '@phosphor-icons/react'

interface MiniCartProps {
  open: boolean
  onClose: () => void
}

const DRAG_CLOSE_THRESHOLD = 80

export function MiniCart({ open, onClose }: MiniCartProps) {
  const items = useCartStore((state) => state.items)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  // Compute subtotal directly from reactive items — avoids Zustand v5 get() hydration timing issue
  const subtotal = (items ?? []).reduce((sum, item) => {
    const price = item.variant.price ?? item.product.price
    return sum + price * item.quantity
  }, 0)
  const dragStartY = useRef(0)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="mini-cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Desktop: right drawer */}
          <motion.div
            key="mini-cart-desktop"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 hidden w-[420px] flex-col bg-white shadow-2xl lg:flex"
          >
            <MiniCartContent subtotal={subtotal} items={items} updateQuantity={updateQuantity} removeItem={removeItem} onClose={onClose} />
          </motion.div>

          {/* Mobile: bottom sheet */}
          <motion.div
            key="mini-cart-mobile"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragStart={(_, info) => { dragStartY.current = info.point.y }}
            onDragEnd={(_, info) => {
              if (info.offset.y > DRAG_CLOSE_THRESHOLD) onClose()
            }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-white shadow-2xl lg:hidden"
            style={{ maxHeight: '85dvh' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-black/15" />
            </div>
            <MiniCartContent subtotal={subtotal} items={items} updateQuantity={updateQuantity} removeItem={removeItem} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

interface MiniCartContentProps {
  subtotal: number
  items: CartItem[]
  updateQuantity: (productId: string, variantId: string, quantity: number) => void
  removeItem: (productId: string, variantId: string) => void
  onClose: () => void
}

function MiniCartContent({ subtotal, items, updateQuantity, removeItem, onClose }: MiniCartContentProps) {
  return (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 shrink-0">
        <div className="flex items-center gap-2">
          <Bag size={18} weight="bold" />
          <span className="text-sm font-black uppercase tracking-[0.12em]">Cart</span>
          {items.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center bg-black px-1 text-[10px] font-black text-white">
              {items.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-black/40 hover:text-black transition-colors"
          aria-label="Close cart"
        >
          <X size={18} weight="bold" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Bag size={40} weight="thin" className="text-black/20" />
          <p className="text-sm font-semibold text-black/40">Your cart is empty</p>
          <Link
            href="/products"
            onClick={onClose}
            className="mt-2 inline-flex items-center gap-1.5 bg-black px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-black/90 transition-colors"
          >
            Shop Now <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      ) : (
        <>
          {/* Items list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {items.map((item) => {
              const price = item.variant.price ?? item.product.price
              const imageUrl = getPrimaryImageWithFallback({
                images: item.variant.images || item.product.images,
                productName: item.product.name,
                productSlug: item.product.slug,
                color: item.variant.color,
                colorHex: item.variant.colorHex,
                size: item.variant.size,
              })
              const key = `${item.product.id}-${item.variant.id}`

              return (
                <div key={key} className="flex gap-3">
                  <Link href={`/products/${item.product.slug}`} onClick={onClose} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black/5">
                    <Image src={imageUrl} alt={item.product.name} fill className="object-cover" />
                  </Link>
                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/products/${item.product.slug}`}
                        onClick={onClose}
                        className="line-clamp-1 text-xs font-bold text-black hover:underline"
                      >
                        {item.product.name}
                      </Link>
                      <button
                        onClick={() => removeItem(item.product.id, item.variant.id)}
                        className="shrink-0 text-black/35 hover:text-rose-600 transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash size={15} weight="bold" />
                      </button>
                    </div>
                    {(item.variant.size || item.variant.color) && (
                      <p className="text-[10px] text-black/40 uppercase tracking-wider">
                        {[item.variant.size, item.variant.color].filter(Boolean).join(' / ')}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center border border-black/15">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.variant.id, item.quantity - 1)}
                          className="flex h-6 w-6 items-center justify-center text-black/60 hover:text-black transition-colors active:scale-75"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={10} weight="bold" />
                        </button>
                        <span className="w-6 text-center text-xs font-black tabular-nums">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.variant.id, item.quantity + 1)}
                          className="flex h-6 w-6 items-center justify-center text-black/60 hover:text-black transition-colors active:scale-75"
                          aria-label="Increase quantity"
                        >
                          <Plus size={10} weight="bold" />
                        </button>
                      </div>
                      <span className="text-sm font-black tabular-nums">${(price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-black/10 px-5 py-4 space-y-3">
            <FreeShippingProgress subtotal={subtotal} />
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-black/60 uppercase tracking-wide">Subtotal</span>
              <span className="text-lg font-black tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-black/40">Shipping and taxes calculated at checkout</p>
            <Link
              href="/checkout"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 bg-black py-3.5 text-xs font-black uppercase tracking-widest text-white hover:bg-black/90 transition-colors active:scale-[0.98]"
            >
              Checkout <ArrowRight size={14} weight="bold" />
            </Link>
            <Link
              href="/cart"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 border border-black/15 py-3 text-xs font-semibold uppercase tracking-wider text-black hover:bg-black/5 transition-colors"
            >
              View Full Cart
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
