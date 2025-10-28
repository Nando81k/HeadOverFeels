'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore } from '@/lib/store/cart'
import { CartItem } from '@/components/cart/CartItem'
import { Button } from '@/components/ui/button'
import { ShoppingBag, ArrowLeft, Loader2, Home, ShoppingCart, Sparkles, Lock, RotateCcw, Truck } from 'lucide-react'
import { motion } from 'framer-motion'

export default function CartPage() {
  const router = useRouter()
  const { items, updateQuantity, removeItem, getTotalPrice, getTotalItems } = useCartStore()
  const [mounted, setMounted] = useState(false)

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  const totalPrice = getTotalPrice()
  const totalItems = getTotalItems()
  const shipping = totalPrice > 100 ? 0 : 10 // Free shipping over $100
  const tax = totalPrice * 0.08 // 8% tax
  const grandTotal = totalPrice + shipping + tax

  const handleCheckout = () => {
    router.push('/checkout')
  }

  // Show loading state during hydration
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F6F1EE] via-[#F6F1EE] to-[#CDA09B]/20 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <ShoppingCart className="w-16 h-16 text-[#FF3131] mx-auto mb-4 animate-pulse" />
          <p className="text-xl font-medium text-gray-800">Loading your cart...</p>
        </motion.div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F6F1EE] via-[#F6F1EE] to-[#CDA09B]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight">
              Shopping Cart
            </h1>
            <p className="text-lg text-gray-600">Your curated streetwear collection</p>
          </motion.div>

          {/* Empty State */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-center py-20"
          >
            <div className="max-w-md mx-auto">
              <div className="relative inline-block mb-8">
                <ShoppingBag className="w-24 h-24 text-[#CDA09B] mx-auto" strokeWidth={1.5} />
                <Sparkles className="w-8 h-8 text-[#FF3131] absolute -top-2 -right-2 animate-pulse" />
              </div>
              
              <h2 className="text-3xl font-bold mb-4">Your Cart is Empty</h2>
              <p className="text-lg text-gray-600 mb-8">
                Ready to start building your streetwear collection?
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/products"
                  className="group inline-flex items-center justify-center gap-3 bg-[#FF3131] text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-black transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  Explore Products
                  <ShoppingCart className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </Link>
                
                <Link
                  href="/"
                  className="group inline-flex items-center justify-center gap-3 bg-white text-gray-800 px-8 py-4 rounded-full font-semibold text-lg hover:shadow-lg transition-all duration-300 hover:scale-105 border-2 border-gray-200"
                >
                  <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Go Home
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F6F1EE] via-[#F6F1EE] to-[#CDA09B]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold mb-3 tracking-tight">
                Shopping Cart
              </h1>
              <p className="text-lg text-gray-600">
                {totalItems} {totalItems === 1 ? 'item' : 'items'} in your cart
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2 bg-white px-6 py-3 rounded-full shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold group"
              >
                <Home className="w-5 h-5 text-gray-700 group-hover:text-[#FF3131] transition-colors" />
                <span className="hidden sm:inline">Home</span>
              </Link>
              
              <Link 
                href="/products"
                className="flex items-center gap-2 bg-white px-6 py-3 rounded-full shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold group"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700 group-hover:text-[#FF3131] transition-colors" />
                <span className="hidden sm:inline">Continue Shopping</span>
              </Link>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <ShoppingCart className="w-6 h-6 text-[#FF3131]" />
                Cart Items
              </h2>
              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <CartItem
                    key={`${item.product.id}-${item.variant.id}`}
                    item={item}
                    onUpdateQuantity={updateQuantity}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Order Summary */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="lg:col-span-1"
          >
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
              <h2 className="text-2xl font-bold mb-6">Order Summary</h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-gray-700">
                  <span className="font-medium">Subtotal</span>
                  <span className="font-semibold">${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span className="font-medium">Shipping</span>
                  <span className="font-semibold">
                    {shipping === 0 ? (
                      <span className="text-green-600 font-bold">FREE</span>
                    ) : (
                      `$${shipping.toFixed(2)}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span className="font-medium">Tax (8%)</span>
                  <span className="font-semibold">${tax.toFixed(2)}</span>
                </div>
                
                {totalPrice < 100 && totalPrice > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4 text-sm"
                  >
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-blue-900 mb-1">Almost there!</p>
                        <p className="text-blue-800">
                          Add <span className="font-bold">${(100 - totalPrice).toFixed(2)}</span> more for free shipping!
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="pt-4 border-t-2 border-gray-200">
                  <div className="flex justify-between text-xl font-bold text-gray-900">
                    <span>Total</span>
                    <span className="text-[#FF3131]">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleCheckout}
                className="w-full bg-[#FF3131] hover:bg-black text-white font-bold py-6 text-lg rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl"
                size="lg"
              >
                Proceed to Checkout
              </Button>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Secure Checkout</p>
                    <p className="text-gray-600">Your payment info is safe</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <RotateCcw className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Free Returns</p>
                    <p className="text-gray-600">Within 30 days of purchase</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 text-purple-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Fast Shipping</p>
                    <p className="text-gray-600">Ships in 2-3 business days</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
