'use client'

import Image from 'next/image'
import { useCartStore } from '@/lib/store/cart'

interface OrderSummaryProps {
  shippingCost?: number
  selectedShippingMethod?: string
}

export function OrderSummary({ shippingCost, selectedShippingMethod }: OrderSummaryProps) {
  const { items, getTotalPrice } = useCartStore()

  const subtotal = getTotalPrice()
  const shipping = shippingCost ?? (subtotal > 100 ? 0 : 10)
  const tax = subtotal * 0.08
  const total = subtotal + shipping + tax

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Summary</h2>

      {/* Cart Items */}
      <div className="space-y-4 mb-6">
        {items.map((item) => {
          const price = item.variant.price || item.product.price
          
          // Parse images
          let imageUrl = '/placeholder-product.jpg'
          try {
            const images = JSON.parse(item.product.images)
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

          return (
            <div key={`${item.product.id}-${item.variant.id}`} className="flex gap-4">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                <Image
                  src={imageUrl}
                  alt={item.product.name}
                  fill
                  className="object-cover"
                />
                <div className="absolute -top-2 -right-2 bg-gray-900 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {item.quantity}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {item.product.name}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {item.variant.size && `Size: ${item.variant.size}`}
                  {item.variant.size && item.variant.color && ' • '}
                  {item.variant.color && `Color: ${item.variant.color}`}
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  ${(price * item.quantity).toFixed(2)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Price Breakdown */}
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <div className="flex flex-col">
            <span>Shipping</span>
            {selectedShippingMethod && (
              <span className="text-xs text-gray-500">{selectedShippingMethod}</span>
            )}
          </div>
          <span className="font-medium text-gray-900">
            {shipping === 0 ? (
              <span className="text-green-600">FREE</span>
            ) : (
              `$${shipping.toFixed(2)}`
            )}
          </span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Tax (8%)</span>
          <span className="font-medium text-gray-900">${tax.toFixed(2)}</span>
        </div>

        <div className="border-t border-gray-200 pt-3">
          <div className="flex justify-between">
            <span className="text-base font-semibold text-gray-900">Total</span>
            <span className="text-lg font-bold text-gray-900">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="mt-6 pt-6 border-t border-gray-200 space-y-2 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Secure SSL encrypted checkout</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span>Free returns within 30 days</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <span>Ships in 2-3 business days</span>
        </div>
      </div>
    </div>
  )
}
