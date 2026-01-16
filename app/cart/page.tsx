'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useCartStore } from '@/lib/store/cart'
import { useAuth } from '@/lib/auth/context'
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
  CircleNotch
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }

  // Empty cart state
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-black/60 hover:text-black transition-colors mb-8 group"
            >
              <ArrowLeft size={20} weight="bold" className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Continue Shopping</span>
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-16"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-black flex items-center justify-center">
                <ShoppingCart size={24} weight="bold" className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-black">Your Cart</h1>
                <p className="text-black/60">0 items</p>
              </div>
            </div>
          </motion.div>

          {/* Empty State */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="max-w-lg mx-auto"
          >
            <div className="bg-white border border-black/10 p-12 text-center">
              <div className="relative inline-block mb-8">
                <div className="w-24 h-24 bg-black/5 flex items-center justify-center mx-auto">
                  <Bag size={48} weight="bold" className="text-black/30" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-2 -right-2"
                >
                  <Heart size={24} weight="fill" className="text-black" />
                </motion.div>
              </div>
              
              <h2 className="text-2xl font-black text-black mb-3">Your cart is empty</h2>
              <p className="text-black/60 mb-8 max-w-sm mx-auto">
                Looks like you haven&apos;t added anything yet. Discover our latest drops and add some heat to your wardrobe.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/products">
                  <button className="w-full sm:w-auto bg-black text-white px-8 py-4 font-bold hover:bg-black/90 transition-colors group flex items-center justify-center gap-2">
                    Shop Now
                    <ArrowRight size={18} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
                <Link href="/">
                  <button className="w-full sm:w-auto border border-black/20 text-black px-8 py-4 font-bold hover:bg-black/5 transition-colors">
                    Back to Home
                  </button>
                </Link>
              </div>
            </div>

            {/* Trust badges */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { icon: Truck, text: 'Free Shipping 100+' },
                { icon: ArrowClockwise, text: '30-Day Returns' },
                { icon: ShieldCheck, text: 'Secure Checkout' },
              ].map((badge, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="text-center"
                >
                  <badge.icon size={24} weight="bold" className="mx-auto text-black/40 mb-2" />
                  <p className="text-xs text-black/50 font-medium">{badge.text}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-black/60 hover:text-black transition-colors mb-8 group"
          >
            <ArrowLeft size={20} weight="bold" className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Continue Shopping</span>
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-black flex items-center justify-center">
              <ShoppingCart size={24} weight="bold" className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-black">Your Cart</h1>
              <p className="text-black/60">
                {totalItems} {totalItems === 1 ? 'item' : 'items'} in your cart
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Cart Items */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-8"
          >
            <div className="bg-white border border-black/10 overflow-hidden">
              {/* Column Headers */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-black/[0.02] border-b border-black/10">
                <div className="col-span-6 text-xs font-bold text-black/50 uppercase tracking-wider">Product</div>
                <div className="col-span-2 text-xs font-bold text-black/50 uppercase tracking-wider text-center">Quantity</div>
                <div className="col-span-2 text-xs font-bold text-black/50 uppercase tracking-wider text-right">Price</div>
                <div className="col-span-2 text-xs font-bold text-black/50 uppercase tracking-wider text-right">Total</div>
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-4"
          >
            <div className="bg-white border border-black/10 p-6 sticky top-28">
              <h2 className="text-xl font-black text-black mb-6">Order Summary</h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-black/70">
                  <span>Subtotal</span>
                  <span className="font-bold text-black">${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-black/70">
                  <span>Shipping</span>
                  <span className="font-bold">
                    {shipping === 0 ? (
                      <span className="text-black">FREE</span>
                    ) : (
                      <span className="text-black">${shipping.toFixed(2)}</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-black/70">
                  <span>Estimated Tax</span>
                  <span className="font-bold text-black">${tax.toFixed(2)}</span>
                </div>
                
                {/* Free shipping progress or loyalty perk */}
                {totalPrice > 0 && (isAdmin || hasTierFreeShipping) && (
                  <div className="bg-black/[0.02] p-4 border border-black/10">
                    <div className="flex items-center gap-2">
                      <Sparkle size={16} weight="fill" className="text-black" />
                      <span className="text-sm font-bold text-black">
                        {isAdmin ? 'Admin free shipping' : `${user?.loyaltyTier?.name} member perk`}
                      </span>
                    </div>
                  </div>
                )}
                {totalPrice < 100 && totalPrice > 0 && !(isAdmin || hasTierFreeShipping) && (
                  <div className="bg-black/[0.02] p-4 border border-black/10">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkle size={16} weight="fill" className="text-black" />
                      <span className="text-sm font-bold text-black">
                        ${(100 - totalPrice).toFixed(2)} away from free shipping
                      </span>
                    </div>
                    <div className="w-full h-1 bg-black/10 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(totalPrice / 100) * 100}%` }}
                        className="h-full bg-black"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-black/10">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-black text-black">Total</span>
                    <span className="text-2xl font-black text-black">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleCheckout}
                className="w-full bg-black text-white font-bold py-4 text-base transition-all hover:bg-black/90 group flex items-center justify-center gap-2"
              >
                Checkout
                <ArrowRight size={18} weight="bold" className="group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Security badges */}
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-black/50">
                <Lock size={14} weight="bold" />
                <span>Secure checkout with SSL encryption</span>
              </div>

              {/* Trust badges */}
              <div className="mt-6 pt-6 border-t border-black/10 space-y-3">
                {[
                  { icon: Truck, title: 'Free Shipping', desc: 'On orders over $100' },
                  { icon: ArrowClockwise, title: 'Easy Returns', desc: '30-day return policy' },
                  { icon: Package, title: 'Fast Delivery', desc: '2-3 business days' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black/5 flex items-center justify-center shrink-0">
                      <item.icon size={18} weight="bold" className="text-black/60" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-black">{item.title}</p>
                      <p className="text-xs text-black/50">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// Inline cart item component
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
      className="p-4 sm:p-6"
    >
      <div className="grid grid-cols-12 gap-3 sm:gap-4 items-center">
        {/* Product Info */}
        <div className="col-span-12 md:col-span-6">
          <div className="flex gap-3 sm:gap-4">
            <Link 
              href={`/products/${product.slug}`}
              className="relative w-20 h-20 sm:w-24 sm:h-24 bg-black/5 overflow-hidden shrink-0 group"
            >
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={24} weight="bold" className="text-black/30" />
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <Link 
                href={`/products/${product.slug}`}
                className="font-bold text-black hover:text-black/70 transition-colors line-clamp-2 text-sm sm:text-base"
              >
                {product.name}
              </Link>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                {variant.size && (
                  <span className="text-xs font-medium px-2 py-1 bg-black/5 text-black/70">
                    {variant.size}
                  </span>
                )}
                {variant.color && (
                  <span className="text-xs font-medium px-2 py-1 bg-black/5 text-black/70">
                    {variant.color}
                  </span>
                )}
              </div>
              <p className="hidden sm:block text-xs text-black/40 mt-1 font-mono">SKU: {variant.sku}</p>
              
              {/* Mobile price */}
              <p className="md:hidden text-base sm:text-lg font-black text-black mt-2">${price.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Quantity - improved touch targets */}
        <div className="col-span-6 md:col-span-2">
          <div className="flex items-center justify-start md:justify-center">
            <div className="inline-flex items-center border border-black/10 overflow-hidden">
              <button
                onClick={() => onUpdateQuantity(product.id, variant.id, quantity - 1)}
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-black/5 active:bg-black/10 transition-colors text-black/70 hover:text-black"
                aria-label="Decrease quantity"
              >
                <Minus size={16} weight="bold" />
              </button>
              <span className="w-10 sm:w-10 text-center text-sm font-bold text-black">{quantity}</span>
              <button
                onClick={() => onUpdateQuantity(product.id, variant.id, quantity + 1)}
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-black/5 active:bg-black/10 transition-colors text-black/70 hover:text-black"
                aria-label="Increase quantity"
              >
                <Plus size={16} weight="bold" />
              </button>
            </div>
          </div>
        </div>

        {/* Price - Desktop */}
        <div className="hidden md:block col-span-2 text-right">
          <span className="font-bold text-black">${price.toFixed(2)}</span>
        </div>

        {/* Total */}
        <div className="col-span-6 md:col-span-2 text-right">
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <span className="font-black text-black text-sm sm:text-base">${subtotal.toFixed(2)}</span>
            <button
              onClick={() => onRemove(product.id, variant.id)}
              className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-black/5 active:bg-red-50 text-black/40 hover:text-black active:text-red-500 transition-colors rounded-lg"
              aria-label="Remove item"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
