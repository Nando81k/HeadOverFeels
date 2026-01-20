'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useCartStore } from '@/lib/store/cart'
import { useAuth } from '@/lib/auth/context'
import { Navigation } from '@/components/layout/Navigation'
import { 
  Bag, 
  ArrowLeft, 
  ShoppingCart, 
  Sparkle, 
  Lock, 
  ArrowClockwise, 
  Truck, 
  Heart, 
  ArrowRight, 
  Package, 
  ShieldCheck,
  X,
  Minus,
  Plus,
  CircleNotch,
  Lightning,
  Crown,
  Fire
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

export default function CartPage() {
  const router = useRouter()
  const { items, updateQuantity, removeItem, getTotalPrice, getTotalItems } = useCartStore()
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)

  // Handle hydration
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  const totalPrice = getTotalPrice()
  const totalItems = getTotalItems()
  // Loyalty and admin free shipping logic
  const isAdmin = user?.isAdmin === true
  const hasTierFreeShipping = user?.loyaltyTier?.freeShipping === true
  const shipping = (isAdmin || hasTierFreeShipping || totalPrice > 100) ? 0 : 10
  const tax = totalPrice * 0.08
  const grandTotal = totalPrice + shipping + tax

  const handleCheckout = () => {
    router.push('/checkout')
  }

  // Loading state
  if (!mounted) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 bg-black flex items-center justify-center">
              <Bag size={28} weight="bold" className="text-white" />
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-2 border-2 border-black/10 border-t-black"
            />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Loading Cart</p>
        </div>
      </>
    )
  }

  // Empty cart state
  if (items.length === 0) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-white pt-20">
          {/* Hero-style empty state */}
          <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-[0.02]">
            <div className="absolute inset-0" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, black 0px, black 1px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, black 0px, black 1px, transparent 1px, transparent 60px)'
            }} />
          </div>

          <div className="relative z-10 max-w-2xl mx-auto px-4 text-center">
            {/* Animated empty bag */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <div className="relative inline-block">
                {/* Main bag icon */}
                <motion.div 
                  className="w-32 h-32 bg-black flex items-center justify-center mx-auto"
                  whileHover={{ scale: 1.02 }}
                >
                  <Bag size={64} weight="bold" className="text-white" />
                </motion.div>
                
                {/* Floating decorative elements */}
                <motion.div
                  animate={{ y: [-5, 5, -5], rotate: [0, 5, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute -top-4 -right-4"
                >
                  <Heart size={28} weight="fill" className="text-black" />
                </motion.div>
                <motion.div
                  animate={{ y: [5, -5, 5], rotate: [0, -5, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                  className="absolute -bottom-2 -left-4"
                >
                  <Sparkle size={24} weight="fill" className="text-black/60" />
                </motion.div>
              </div>
            </motion.div>

            {/* Text content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-black/40 mb-4">Your Cart</p>
              <h1 className="text-4xl md:text-6xl font-black text-black mb-6 tracking-tight">
                Nothing Here Yet
              </h1>
              <p className="text-lg text-black/50 max-w-md mx-auto mb-10 leading-relaxed">
                Your shopping bag is waiting to be filled with amazing pieces from our collection.
              </p>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/products">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto bg-black text-white px-10 py-5 font-black text-sm uppercase tracking-widest hover:bg-black/90 transition-colors group flex items-center justify-center gap-3"
                >
                  Start Shopping
                  <ArrowRight size={18} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </Link>
              <Link href="/drops">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto border-2 border-black text-black px-10 py-5 font-black text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all group flex items-center justify-center gap-3"
                >
                  <Fire size={18} weight="bold" />
                  View Drops
                </motion.button>
              </Link>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="mt-16 pt-12 border-t border-black/10"
            >
              <div className="flex flex-wrap justify-center gap-8 md:gap-12">
                {[
                  { icon: Truck, label: 'Free Shipping', sub: '$100+' },
                  { icon: ArrowClockwise, label: 'Easy Returns', sub: '30 Days' },
                  { icon: ShieldCheck, label: 'Secure Payment', sub: 'SSL' },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-black/5 flex items-center justify-center">
                      <item.icon size={18} weight="bold" className="text-black/40" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-black text-black uppercase tracking-wide">{item.label}</p>
                      <p className="text-[10px] text-black/40 uppercase tracking-wider">{item.sub}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        {/* Back navigation */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-black/40 hover:text-black transition-colors group"
          >
            <ArrowLeft size={16} weight="bold" className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Continue Shopping</span>
          </Link>
        </motion.div>

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-black flex items-center justify-center">
                <Bag size={26} weight="bold" className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-1">Shopping</p>
                <h1 className="text-4xl md:text-5xl font-black text-black tracking-tight">Cart</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 text-black/40">
              <span className="text-3xl font-black text-black tabular-nums">{totalItems}</span>
              <span className="text-sm font-bold uppercase tracking-wide">{totalItems === 1 ? 'Item' : 'Items'}</span>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Cart Items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-8"
          >
            <div className="border border-black/10 overflow-hidden">
              {/* Column Headers */}
              <div className="hidden md:flex items-center px-6 py-4 bg-black text-white gap-4">
                <div className="flex-1 min-w-0 basis-1/2">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Product</span>
                </div>
                <div className="w-[16.666%] text-center">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Qty</span>
                </div>
                <div className="w-[16.666%] text-right">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Price</span>
                </div>
                <div className="w-[16.666%] text-right pr-11">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Total</span>
                </div>
              </div>

              {/* Mobile Header */}
              <div className="md:hidden px-4 py-3 bg-black text-white">
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{totalItems} {totalItems === 1 ? 'Item' : 'Items'} in Cart</span>
              </div>
              
              {/* Cart Items List */}
              <AnimatePresence mode="popLayout">
                <div className="divide-y divide-black/10">
                  {items.map((item, index) => (
                    <CartItemRow
                      key={`${item.product.id}-${item.variant.id}`}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeItem}
                      index={index}
                    />
                  ))}
                </div>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Order Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-4"
          >
            <div className="border border-black/10 sticky top-28">
              {/* Summary Header */}
              <div className="bg-black text-white px-6 py-4">
                <h2 className="text-[9px] font-black uppercase tracking-[0.2em]">Order Summary</h2>
              </div>
              
              <div className="p-6">
                {/* Price breakdown */}
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black/60">Subtotal</span>
                    <span className="text-sm font-black text-black tabular-nums">${totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black/60">Shipping</span>
                    {shipping === 0 ? (
                      <span className="text-sm font-black text-black flex items-center gap-1">
                        <Sparkle size={12} weight="fill" />
                        FREE
                      </span>
                    ) : (
                      <span className="text-sm font-black text-black tabular-nums">${shipping.toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black/60">Tax</span>
                    <span className="text-sm font-black text-black tabular-nums">${tax.toFixed(2)}</span>
                  </div>
                </div>

                {/* Free shipping progress or loyalty perk */}
                {totalPrice > 0 && (isAdmin || hasTierFreeShipping) && (
                  <div className="mb-6 p-4 bg-black/5">
                    <div className="flex items-center gap-3">
                      <Crown size={20} weight="fill" className="text-black" />
                      <div>
                        <p className="text-xs font-black text-black uppercase tracking-wide">
                          {isAdmin ? 'Admin Perk' : `${user?.loyaltyTier?.name} Perk`}
                        </p>
                        <p className="text-[10px] text-black/50">Free shipping applied</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {totalPrice < 100 && totalPrice > 0 && !(isAdmin || hasTierFreeShipping) && (
                  <div className="mb-6 p-4 bg-black/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Lightning size={16} weight="fill" className="text-black" />
                        <span className="text-xs font-black text-black uppercase tracking-wide">Free Shipping</span>
                      </div>
                      <span className="text-[10px] font-bold text-black/60 tabular-nums">${(100 - totalPrice).toFixed(2)} away</span>
                    </div>
                    <div className="w-full h-2 bg-black/10 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((totalPrice / 100) * 100, 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full bg-black"
                      />
                    </div>
                    <p className="text-[10px] text-black/40 mt-2">Add ${(100 - totalPrice).toFixed(2)} more for free shipping</p>
                  </div>
                )}

                {/* Total */}
                <div className="py-4 border-t-2 border-black mb-6">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-black text-black uppercase tracking-wide">Total</span>
                    <span className="text-3xl font-black text-black tabular-nums">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Checkout button */}
                <motion.button 
                  onClick={handleCheckout}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full bg-black text-white font-black py-5 text-sm uppercase tracking-widest transition-all hover:bg-black/90 group flex items-center justify-center gap-3"
                >
                  Checkout
                  <ArrowRight size={18} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                </motion.button>

                {/* Security note */}
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Lock size={12} weight="bold" className="text-black/30" />
                  <span className="text-[10px] text-black/40 uppercase tracking-wider">Secure SSL Checkout</span>
                </div>
              </div>

              {/* Trust badges */}
              <div className="border-t border-black/10 p-6 bg-black/2">
                <div className="space-y-4">
                  {[
                    { icon: Truck, title: 'Free Shipping', desc: 'Orders over $100' },
                    { icon: ArrowClockwise, title: 'Easy Returns', desc: '30-day policy' },
                    { icon: Package, title: 'Fast Delivery', desc: '2-3 business days' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white border border-black/10 flex items-center justify-center shrink-0">
                        <item.icon size={18} weight="bold" className="text-black/60" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-black uppercase tracking-wide">{item.title}</p>
                        <p className="text-[10px] text-black/40">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      </div>
    </>
  )
}

// Inline cart item component - Redesigned with proper column alignment
function CartItemRow({ 
  item, 
  onUpdateQuantity, 
  onRemove,
  index 
}: { 
  item: ReturnType<typeof useCartStore.getState>['items'][0]
  onUpdateQuantity: (productId: string, variantId: string, quantity: number) => void
  onRemove: (productId: string, variantId: string) => void
  index: number
}) {
  const { product, variant, quantity } = item
  const price = variant.price || product.price
  const subtotal = price * quantity

  // Parse images
  const getImageUrl = (): string | null => {
    try {
      const images = JSON.parse(product.images)
      if (images && images.length > 0) {
        const first = images[0]
        if (typeof first === 'string' && first.startsWith('http')) return first
        if (first?.url && first.url.startsWith('http')) return first.url
      }
    } catch {
      // ignore
    }
    return null
  }

  const imageUrl = getImageUrl()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ delay: index * 0.05 }}
      className="group"
    >
      {/* Desktop Layout - Table-like row */}
      <div className="hidden md:flex items-center px-6 py-5 gap-4 hover:bg-black/2 transition-colors">
        {/* Product - Fixed width to match header */}
        <div className="flex-1 min-w-0 basis-1/2">
          <div className="flex gap-4">
            <Link 
              href={`/products/${product.slug}`}
              className="relative w-20 h-20 bg-black/5 overflow-hidden shrink-0 group/img"
            >
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover/img:scale-110"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={24} weight="bold" className="text-black/30" />
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0 py-1">
              <Link 
                href={`/products/${product.slug}`}
                className="font-bold text-sm text-black hover:text-black/70 transition-colors line-clamp-1"
              >
                {product.name}
              </Link>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {variant.size && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-black/5 text-black/60">
                    {variant.size}
                  </span>
                )}
                {variant.color && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-black/5 text-black/60">
                    {variant.color}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-black/30 mt-1.5 font-mono tracking-wide">SKU: {variant.sku}</p>
            </div>
          </div>
        </div>

        {/* Quantity - Fixed width centered */}
        <div className="w-[16.666%] flex justify-center">
          <div className="inline-flex items-center border border-black/10">
            <button
              onClick={() => onUpdateQuantity(product.id, variant.id, quantity - 1)}
              className="w-8 h-8 flex items-center justify-center hover:bg-black hover:text-white transition-all text-black/50"
              aria-label="Decrease quantity"
            >
              <Minus size={12} weight="bold" />
            </button>
            <span className="w-10 text-center text-xs font-black text-black tabular-nums">{quantity}</span>
            <button
              onClick={() => onUpdateQuantity(product.id, variant.id, quantity + 1)}
              className="w-8 h-8 flex items-center justify-center hover:bg-black hover:text-white transition-all text-black/50"
              aria-label="Increase quantity"
            >
              <Plus size={12} weight="bold" />
            </button>
          </div>
        </div>

        {/* Price - Fixed width right aligned */}
        <div className="w-[16.666%] text-right">
          <span className="text-sm font-bold text-black/70 tabular-nums">${price.toFixed(2)}</span>
        </div>

        {/* Total - Fixed width right aligned with remove button */}
        <div className="w-[16.666%] flex items-center justify-end gap-3">
          <span className="text-sm font-black text-black tabular-nums">${subtotal.toFixed(2)}</span>
          <button
            onClick={() => onRemove(product.id, variant.id)}
            className="w-8 h-8 flex items-center justify-center text-black/20 hover:text-black hover:bg-black/5 transition-all opacity-0 group-hover:opacity-100"
            aria-label="Remove item"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      </div>

      {/* Mobile Layout - Card style */}
      <div className="md:hidden p-4 hover:bg-black/2 transition-colors">
        <div className="flex gap-4">
          {/* Image */}
          <Link 
            href={`/products/${product.slug}`}
            className="relative w-24 h-24 bg-black/5 overflow-hidden shrink-0"
          >
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package size={24} weight="bold" className="text-black/30" />
              </div>
            )}
          </Link>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <Link 
                href={`/products/${product.slug}`}
                className="font-bold text-sm text-black hover:text-black/70 transition-colors line-clamp-2 flex-1"
              >
                {product.name}
              </Link>
              <button
                onClick={() => onRemove(product.id, variant.id)}
                className="w-8 h-8 flex items-center justify-center text-black/30 hover:text-black transition-colors shrink-0 -mr-2 -mt-1"
                aria-label="Remove item"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              {variant.size && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-black/5 text-black/60">
                  {variant.size}
                </span>
              )}
              {variant.color && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-black/5 text-black/60">
                  {variant.color}
                </span>
              )}
            </div>

            {/* Price & Quantity Row */}
            <div className="flex items-center justify-between mt-4">
              <div className="inline-flex items-center border border-black/10">
                <button
                  onClick={() => onUpdateQuantity(product.id, variant.id, quantity - 1)}
                  className="w-9 h-9 flex items-center justify-center hover:bg-black hover:text-white transition-all text-black/50"
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} weight="bold" />
                </button>
                <span className="w-10 text-center text-sm font-black text-black tabular-nums">{quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(product.id, variant.id, quantity + 1)}
                  className="w-9 h-9 flex items-center justify-center hover:bg-black hover:text-white transition-all text-black/50"
                  aria-label="Increase quantity"
                >
                  <Plus size={14} weight="bold" />
                </button>
              </div>

              <div className="text-right">
                <p className="text-lg font-black text-black tabular-nums">${subtotal.toFixed(2)}</p>
                {quantity > 1 && (
                  <p className="text-[10px] text-black/40">${price.toFixed(2)} each</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
