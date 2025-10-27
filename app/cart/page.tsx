'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore } from '@/lib/store/cart'
import { CartItem } from '@/components/cart/CartItem'
import { Button } from '@/components/ui/button'
import { ShoppingBag, ArrowLeft, Loader2 } from 'lucide-react'

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
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#6B6B6B]" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAF8F5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Empty State */}
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-[#E5DDD5] mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">
              Your cart is empty
            </h2>
            <p className="text-[#6B6B6B] mb-8">
              Start shopping to add items to your cart
            </p>
            <Link href="/products">
              <Button size="lg">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/products"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Continue Shopping
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
          <p className="text-gray-600 mt-2">
            {totalItems} {totalItems === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Cart Items</h2>
              <div className="divide-y divide-gray-200">
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
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>
                    {shipping === 0 ? (
                      <span className="text-green-600 font-medium">FREE</span>
                    ) : (
                      `$${shipping.toFixed(2)}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                
                {totalPrice < 100 && totalPrice > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    Add ${(100 - totalPrice).toFixed(2)} more for free shipping!
                  </div>
                )}

                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>${grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleCheckout}
                className="w-full"
                size="lg"
              >
                Proceed to Checkout
              </Button>

              <div className="mt-6 space-y-2 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Secure checkout</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Free returns within 30 days</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Ships in 2-3 business days</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
