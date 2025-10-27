'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Package, Mail, Loader2, Star, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OrderItem {
  id: string
  productName: string
  productImage: string | null
  quantity: number
  price: number
  variantDetails: string | null
}

interface Order {
  id: string
  orderNumber: string
  customerEmail: string
  total: number
  subtotal: number
  shipping: number
  tax: number
  status: string
  items: OrderItem[]
  shippingAddress: {
    firstName: string
    lastName: string
    address1: string
    address2: string | null
    city: string
    state: string
    postalCode: string
  }
  createdAt: string
  trackingNumber?: string
  carrier?: string
  trackingUrl?: string
  shippedAt?: string
  estimatedDelivery?: string
}

function ConfirmationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const orderId = searchParams.get('orderId')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If not coming from successful payment, redirect
    if (!success || !orderId) {
      router.push('/products')
      return
    }

    // Fetch order details and send confirmation email
    const fetchOrderAndSendEmail = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch order')
        }
        const data = await response.json()
        setOrder(data.data)
        
        // Send confirmation email in the background (don't block UI)
        fetch(`/api/orders/${orderId}/send-confirmation`, {
          method: 'POST',
        }).catch((err) => {
          console.error('Failed to send confirmation email:', err)
          // Don't show error to user - email is secondary
        })
      } catch (err) {
        console.error('Error fetching order:', err)
        setError('Failed to load order details')
      } finally {
        setLoading(false)
      }
    }

    fetchOrderAndSendEmail()
  }, [success, orderId, router])

  if (!success || !orderId) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <p className="text-red-600 mb-4">{error || 'Order not found'}</p>
          <Button asChild>
            <Link href="/products">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-3xl w-full bg-white rounded-lg shadow-sm p-8 md:p-12">
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Order Confirmed!
          </h1>
          <p className="text-lg text-neutral-600 mb-2">
            Thank you for your purchase. Your order has been successfully processed.
          </p>
          <p className="text-sm text-neutral-500">
            Order #{order.orderNumber}
          </p>
        </div>

        {/* Order Details */}
        <div className="mb-8 p-6 bg-neutral-50 rounded-lg">
          <h3 className="font-semibold mb-4">Order Details</h3>
          
          {/* Order Items */}
          <div className="space-y-3 mb-4">
            {order.items.map((item) => {
              const variantInfo = item.variantDetails ? JSON.parse(item.variantDetails) : null
              return (
                <div key={item.id} className="flex gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{item.productName}</p>
                    {variantInfo && (
                      <p className="text-sm text-neutral-600">
                        {variantInfo.size && `Size: ${variantInfo.size}`}
                        {variantInfo.color && ` • Color: ${variantInfo.color}`}
                      </p>
                    )}
                    <p className="text-sm text-neutral-600">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                </div>
              )
            })}
          </div>

          {/* Price Breakdown */}
          <div className="pt-4 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Subtotal</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Shipping</span>
              <span>{order.shipping === 0 ? 'FREE' : `$${order.shipping.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Tax</span>
              <span>${order.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg pt-2 border-t">
              <span>Total</span>
              <span>${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="mb-8 p-6 bg-neutral-50 rounded-lg">
          <h3 className="font-semibold mb-2">Shipping Address</h3>
          <div className="text-sm text-neutral-600">
            <p className="font-medium text-black">
              {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            </p>
            <p>{order.shippingAddress.address1}</p>
            {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
            </p>
          </div>
        </div>

        {/* Tracking Information - Only show if order has shipped */}
        {order.trackingNumber && (
          <div className="mb-8 p-6 bg-linear-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2 text-green-900">
                  Your Order Has Shipped! 🎉
                </h3>
                <p className="text-sm text-green-800 mb-4">
                  Your package is on its way. Track your shipment below.
                </p>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-green-900 mb-1">Tracking Number</p>
                    <p className="text-lg font-mono bg-white px-3 py-2 rounded border border-green-200 inline-block">
                      {order.trackingNumber}
                    </p>
                  </div>
                  
                  {order.carrier && (
                    <div>
                      <p className="text-sm font-medium text-green-900 mb-1">Carrier</p>
                      <p className="text-sm text-green-800">{order.carrier}</p>
                    </div>
                  )}
                  
                  {order.estimatedDelivery && (
                    <div>
                      <p className="text-sm font-medium text-green-900 mb-1">Estimated Delivery</p>
                      <p className="text-sm text-green-800">
                        {new Date(order.estimatedDelivery).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-3 pt-2">
                    {order.trackingUrl && (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                      >
                        <Package className="w-4 h-4" />
                        Track Package
                      </a>
                    )}
                    <Link
                      href={`/order/track/${order.id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-green-300 text-green-900 rounded-lg hover:bg-green-50 transition-colors font-medium"
                    >
                      View Order Details
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info cards */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="p-4 bg-neutral-50 rounded-lg">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-neutral-600 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Email Confirmation</h3>
                <p className="text-sm text-neutral-600">
                  We&apos;ve sent a confirmation to {order.customerEmail}
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-neutral-50 rounded-lg">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-neutral-600 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Shipping Updates</h3>
                <p className="text-sm text-neutral-600">
                  You&apos;ll receive shipping updates as your order ships
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What's next */}
        <div className="p-6 bg-neutral-50 rounded-lg mb-8">
          <h3 className="font-semibold mb-3">What&apos;s Next?</h3>
          <ul className="space-y-2 text-sm text-neutral-600">
            <li className="flex items-start gap-2">
              <span className="text-black">•</span>
              <span>Your order will be processed within 1-2 business days</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-black">•</span>
              <span>Standard shipping typically takes 3-5 business days</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-black">•</span>
              <span>You can track your order using the link in your confirmation email</span>
            </li>
          </ul>
        </div>

        {/* Review CTA */}
        <div className="p-6 bg-linear-to-br from-purple-50 to-blue-50 rounded-lg mb-8 border border-purple-100">
          <div className="flex items-start gap-3 mb-4">
            <div className="shrink-0">
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                <Star className="w-5 h-5 text-white fill-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Share Your Experience</h3>
              <p className="text-sm text-neutral-600 mb-4">
                Once you receive your items, we&apos;d love to hear what you think! Your review helps other customers make confident purchases.
              </p>
              <div className="flex flex-wrap gap-2">
                {order.items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/products/${item.productName.toLowerCase().replace(/\s+/g, '-')}?writeReview=true&orderId=${order.id}`}
                    className="text-sm px-4 py-2 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all"
                  >
                    Review {item.productName}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto"
          >
            <Link href="/products">
              Continue Shopping
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
          >
            <Link href="/">
              Back to Home
            </Link>
          </Button>
        </div>

        {/* Support */}
        <p className="mt-8 text-sm text-neutral-500 text-center">
          Questions about your order?{' '}
          <Link href="/contact" className="text-black hover:underline">
            Contact us
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ConfirmationContent />
    </Suspense>
  )
}
