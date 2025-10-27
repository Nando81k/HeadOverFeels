'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Package, Truck, CheckCircle, MapPin, Calendar, ExternalLink } from 'lucide-react'

interface OrderTracking {
  id: string
  orderNumber: string
  status: string
  trackingNumber?: string | null
  carrier?: string | null
  shippedAt?: string | null
  estimatedDelivery?: string | null
  deliveredAt?: string | null
  shippingMethod?: string | null
  customerEmail: string
  shippingAddress: {
    firstName: string
    lastName: string
    address1: string
    address2?: string | null
    city: string
    state: string
    zipCode: string
    country: string
  }
  items: Array<{
    quantity: number
    product: {
      name: string
      slug: string
      images: string
    }
    productVariant?: {
      size?: string | null
      color?: string | null
    } | null
  }>
  createdAt: string
}

export default function OrderTrackingPage() {
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<OrderTracking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) return

    const fetchTracking = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}/tracking`)
        const data = await response.json()

        if (response.ok && data.data) {
          setOrder(data.data)
        } else {
          setError(data.error || 'Order not found')
        }
      } catch (err) {
        console.error('Error fetching tracking:', err)
        setError('Failed to load tracking information')
      } finally {
        setLoading(false)
      }
    }

    fetchTracking()
  }, [orderId])

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getCarrierTrackingUrl = (carrier?: string | null, trackingNumber?: string | null) => {
    if (!carrier || !trackingNumber) return null

    const urls: Record<string, string> = {
      USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
      FedEx: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      UPS: `https://www.ups.com/track?tracknum=${trackingNumber}`,
      DHL: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
    }

    return urls[carrier]
  }

  const getStatusStep = (status: string) => {
    const steps = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']
    return steps.indexOf(status)
  }

  const getProductImage = (images: string) => {
    try {
      const parsed = JSON.parse(images)
      return parsed[0] || '/placeholder-product.jpg'
    } catch {
      return '/placeholder-product.jpg'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black mb-4" />
          <p className="text-gray-600">Loading tracking information...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'Unable to find tracking information for this order.'}</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  const currentStep = getStatusStep(order.status)
  const carrierUrl = getCarrierTrackingUrl(order.carrier, order.trackingNumber)

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Order</h1>
          <p className="text-gray-600">
            Order <span className="font-semibold">#{order.orderNumber}</span>
          </p>
        </div>

        {/* Tracking Timeline */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 mb-6">
          <div className="flex items-center justify-between mb-8">
            {['Ordered', 'Confirmed', 'Processing', 'Shipped', 'Delivered'].map((step, index) => (
              <div key={step} className="flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                    index <= currentStep
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {index === 0 && <Package className="w-6 h-6" />}
                  {index === 1 && <CheckCircle className="w-6 h-6" />}
                  {index === 2 && <Package className="w-6 h-6" />}
                  {index === 3 && <Truck className="w-6 h-6" />}
                  {index === 4 && <CheckCircle className="w-6 h-6" />}
                </div>
                <span
                  className={`text-xs sm:text-sm font-medium text-center ${
                    index <= currentStep ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {step}
                </span>
                {index < 4 && (
                  <div
                    className={`hidden sm:block absolute h-0.5 w-full -z-10 ${
                      index < currentStep ? 'bg-purple-600' : 'bg-gray-200'
                    }`}
                    style={{
                      left: `${(index + 1) * 20}%`,
                      width: '20%',
                      top: '24px',
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Current Status */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {order.status === 'DELIVERED'
                ? '📦 Delivered!'
                : order.status === 'SHIPPED'
                ? '🚚 Your Order is On Its Way'
                : '📦 Order In Progress'}
            </h2>
            <p className="text-gray-700">
              {order.status === 'DELIVERED'
                ? 'Your order has been delivered. We hope you love your new items!'
                : order.status === 'SHIPPED'
                ? 'Your package is currently in transit to your delivery address.'
                : 'Your order is being prepared for shipment.'}
            </p>
          </div>

          {/* Tracking Information */}
          {order.trackingNumber && (
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Package className="w-4 h-4" />
                  <span className="text-sm font-medium">Tracking Number</span>
                </div>
                <p className="font-mono text-lg font-semibold text-gray-900">
                  {order.trackingNumber}
                </p>
                {order.carrier && (
                  <p className="text-sm text-gray-600 mt-1">Carrier: {order.carrier}</p>
                )}
              </div>

              {order.estimatedDelivery && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm font-medium">Estimated Delivery</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatDate(order.estimatedDelivery)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Carrier Tracking Link */}
          {carrierUrl && (
            <a
              href={carrierUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors mb-4"
            >
              <ExternalLink className="w-4 h-4" />
              Track on {order.carrier} Website
            </a>
          )}

          {/* Shipping Address */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 text-gray-700 mb-3">
              <MapPin className="w-5 h-5" />
              <h3 className="font-semibold">Shipping Address</h3>
            </div>
            <div className="text-gray-700">
              <p className="font-medium">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
              </p>
              <p>{order.shippingAddress.address1}</p>
              {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                {order.shippingAddress.zipCode}
              </p>
              <p>{order.shippingAddress.country}</p>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Items</h2>
          <div className="space-y-4">
            {order.items.map((item, index) => (
              <div key={index} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  <Image
                    src={getProductImage(item.product.images)}
                    alt={item.product.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="font-medium text-gray-900 hover:text-purple-600 block"
                  >
                    {item.product.name}
                  </Link>
                  {item.productVariant && (
                    <p className="text-sm text-gray-600 mt-1">
                      {item.productVariant.size && `Size: ${item.productVariant.size}`}
                      {item.productVariant.size && item.productVariant.color && ' | '}
                      {item.productVariant.color && `Color: ${item.productVariant.color}`}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">Quantity: {item.quantity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <h3 className="font-semibold text-blue-900 mb-2">Need Help?</h3>
          <p className="text-blue-800 text-sm mb-4">
            If you have any questions about your order, we&apos;re here to help!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/contact"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Contact Support
            </Link>
            <Link
              href="/"
              className="inline-block px-6 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
