'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useCartStore } from '@/lib/store/cart'
import { CartItem } from '@/components/cart/CartItem'
import { Button } from '@/components/ui/button'
import { Bag, ArrowLeft, ShoppingCart, Sparkle, Lock, ArrowClockwise, Truck, Heart, ArrowRight, Package, ShieldCheck } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navigation } from '@/components/layout/Navigation'

export default function CartPage() {
  const router = useRouter()
  const { items, updateQuantity, removeItem, getTotalPrice, getTotalItems } = useCartStore()
  const [mounted, setMounted] = useState(false)

  // Handle hydration
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  const totalPrice = getTotalPrice()
  const totalItems = getTotalItems()
  const shipping = totalPrice > 100 ? 0 : 10
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
        <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-black/5 flex items-center justify-center">
              <ShoppingCart size={32} weight="bold" className="text-black animate-pulse" />
            </div>
            <p className="text-lg font-medium text-black/60">Loading your cart...</p>
          </motion.div>
        </div>
      </>
    )
  }

  // Empty cart state
  if (items.length === 0) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-[#FAF8F5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-16"
            >
              <h1 className="text-5xl md:text-6xl font-black tracking-tight logo-font text-black mb-4">
                Your Cart
              </h1>
              <div className="w-20 h-1 bg-black mx-auto rounded-full" />
            </motion.div>

            {/* Empty State Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="max-w-lg mx-auto"
            >
              <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-black/5">
                <div className="relative inline-block mb-8">
                  <div className="w-32 h-32 rounded-full bg-black/5 flex items-center justify-center mx-auto">
                    <Bag size={64} weight="duotone" className="text-black/40" />
                  </div>
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-2 -right-2"
                  >
                    <Heart size={32} weight="fill" className="text-[#FF3131]" />
                  </motion.div>
                </div>
                
                <h2 className="text-2xl font-bold text-black mb-3">Your cart is empty</h2>
                <p className="text-black/60 mb-8 max-w-sm mx-auto">
                  Looks like you haven&apos;t added anything yet. Discover our latest drops and add some heat to your wardrobe.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/products">
                    <Button className="w-full sm:w-auto bg-black hover:bg-black/80 text-white px-8 py-6 rounded-full font-semibold text-base group">
                      Shop Now
                      <ArrowRight size={18} weight="bold" className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline" className="w-full sm:w-auto border-black/20 hover:bg-black/5 px-8 py-6 rounded-full font-semibold text-base">
                      Back to Home
                    </Button>
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
                    transition={{ delay: 0.2 + i * 0.1 }}
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
      </>
    )
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-[#FAF8F5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <Link 
                  href="/products"
                  className="inline-flex items-center gap-2 text-black/60 hover:text-black transition-colors text-sm font-medium mb-4"
                >
                  <ArrowLeft size={16} weight="bold" />
                  Continue Shopping
                </Link>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight logo-font text-black">
                  Your Cart
                </h1>
                <p className="text-black/60 mt-2">
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
              transition={{ delay: 0.1 }}
              className="lg:col-span-8"
            >
              <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                {/* Column Headers */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-black/[0.02] border-b border-black/5">
                  <div className="col-span-6 text-xs font-semibold text-black/50 uppercase tracking-wider">Product</div>
                  <div className="col-span-2 text-xs font-semibold text-black/50 uppercase tracking-wider text-center">Quantity</div>
                  <div className="col-span-2 text-xs font-semibold text-black/50 uppercase tracking-wider text-right">Price</div>
                  <div className="col-span-2 text-xs font-semibold text-black/50 uppercase tracking-wider text-right">Total</div>
                </div>
                
                {/* Cart Items List */}
                <AnimatePresence mode="popLayout">
                  <div className="divide-y divide-black/5">
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
              transition={{ delay: 0.2 }}
              className="lg:col-span-4"
            >
              <div className="bg-white rounded-3xl shadow-sm border border-black/5 p-6 sticky top-28">
                <h2 className="text-xl font-bold text-black mb-6">Order Summary</h2>
                
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-black/70">
                    <span>Subtotal</span>
                    <span className="font-semibold text-black">${totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-black/70">
                    <span>Shipping</span>
                    <span className="font-semibold">
                      {shipping === 0 ? (
                        <span className="text-green-600">FREE</span>
                      ) : (
                        <span className="text-black">${shipping.toFixed(2)}</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-black/70">
                    <span>Estimated Tax</span>
                    <span className="font-semibold text-black">${tax.toFixed(2)}</span>
                  </div>
                  
                  {/* Free shipping progress */}
                  {totalPrice < 100 && totalPrice > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-black/[0.02] rounded-2xl p-4 border border-black/5"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkle size={16} weight="fill" className="text-[#FF3131]" />
                        <span className="text-sm font-semibold text-black">
                          ${(100 - totalPrice).toFixed(2)} away from free shipping!
                        </span>
                      </div>
                      <div className="w-full h-2 bg-black/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(totalPrice / 100) * 100}%` }}
                          className="h-full bg-[#FF3131] rounded-full"
                        />
                      </div>
                    </motion.div>
                  )}

                  <div className="pt-4 border-t border-black/10">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-black">Total</span>
                      <span className="text-2xl font-black text-black">${grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleCheckout}
                  className="w-full bg-black hover:bg-black/80 text-white font-bold py-6 text-base rounded-full transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group"
                  size="lg"
                >
                  Checkout
                  <ArrowRight size={18} weight="bold" className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>

                {/* Security badges */}
                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-black/50">
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
                      <div className="w-10 h-10 rounded-full bg-black/[0.03] flex items-center justify-center shrink-0">
                        <item.icon size={18} weight="bold" className="text-black/60" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-black">{item.title}</p>
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
    </>
  )
}

// Inline cart item component for better layout control
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
  let imageUrl = '/placeholder-product.jpg'
  try {
    const images = JSON.parse(product.images)
    if (images && images.length > 0 && images[0].url) {
      imageUrl = images[0].url
    }
  } catch {
    // Use placeholder
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ delay: index * 0.05 }}
      className="p-6"
    >
      <div className="grid grid-cols-12 gap-4 items-center">
        {/* Product Info */}
        <div className="col-span-12 md:col-span-6">
          <div className="flex gap-4">
            <Link 
              href={`/products/${product.slug}`}
              className="relative w-24 h-24 rounded-2xl overflow-hidden bg-black/[0.02] shrink-0 group"
            >
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <Link 
                href={`/products/${product.slug}`}
                className="font-semibold text-black hover:text-[#FF3131] transition-colors line-clamp-2"
              >
                {product.name}
              </Link>
              <div className="flex flex-wrap gap-2 mt-2">
                {variant.size && (
                  <span className="text-xs font-medium px-2 py-1 bg-black/[0.03] rounded-full text-black/70">
                    {variant.size}
                  </span>
                )}
                {variant.color && (
                  <span className="text-xs font-medium px-2 py-1 bg-black/[0.03] rounded-full text-black/70">
                    {variant.color}
                  </span>
                )}
              </div>
              <p className="text-xs text-black/40 mt-1 font-mono">SKU: {variant.sku}</p>
              
              {/* Mobile price */}
              <p className="md:hidden text-lg font-bold text-black mt-2">${price.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Quantity */}
        <div className="col-span-6 md:col-span-2">
          <div className="flex items-center justify-start md:justify-center">
            <div className="inline-flex items-center border border-black/10 rounded-full overflow-hidden">
              <button
                onClick={() => onUpdateQuantity(product.id, variant.id, quantity - 1)}
                className="w-8 h-8 flex items-center justify-center hover:bg-black/5 transition-colors text-black/70 hover:text-black"
                aria-label="Decrease quantity"
              >
                <span className="text-lg font-medium">−</span>
              </button>
              <span className="w-10 text-center text-sm font-semibold text-black">{quantity}</span>
              <button
                onClick={() => onUpdateQuantity(product.id, variant.id, quantity + 1)}
                className="w-8 h-8 flex items-center justify-center hover:bg-black/5 transition-colors text-black/70 hover:text-black"
                aria-label="Increase quantity"
              >
                <span className="text-lg font-medium">+</span>
              </button>
            </div>
          </div>
        </div>

        {/* Price - Desktop */}
        <div className="hidden md:block col-span-2 text-right">
          <span className="font-semibold text-black">${price.toFixed(2)}</span>
        </div>

        {/* Total */}
        <div className="col-span-6 md:col-span-2 text-right">
          <div className="flex items-center justify-end gap-3">
            <span className="font-bold text-black">${subtotal.toFixed(2)}</span>
            <button
              onClick={() => onRemove(product.id, variant.id)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-black/40 hover:text-[#FF3131] transition-colors"
              aria-label="Remove item"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
