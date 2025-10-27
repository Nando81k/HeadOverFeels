'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { 
  CheckCircle2, 
  Package, 
  Truck, 
  Home,
  Clock,
  AlertCircle,
  ExternalLink,
  Loader2,
  MapPin
} from 'lucide-react'
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
  deliveredAt?: string
}

const STATUS_ICONS = {
  PENDING: Clock,
  PROCESSING: Package,
  SHIPPED: Truck,
  DELIVERED: Home,
  CANCELLED: AlertCircle,
}

const STATUS_COLORS = {
  PENDING: 'text-yellow-600 bg-yellow-100',
  PROCESSING: 'text-blue-600 bg-blue-100',
  SHIPPED: 'text-purple-600 bg-purple-100',
  DELIVERED: 'text-green-600 bg-green-100',
  CANCELLED: 'text-red-600 bg-red-100',
}

export default function OrderTrackingPage() {
  const params = useParams()
  const orderId = params.id as string
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) return

    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`)
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Order not found')
          }
          throw new Error('Failed to fetch order')
        }
        const data = await response.json()
        setOrder(data.data)
      } catch (err) {
        console.error('Error fetching order:', err)
        setError(err instanceof Error ? err.message : 'Failed to load order')
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderId])

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
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
          <p className="text-neutral-600 mb-6">
            {error || 'We couldn\'t find an order with this ID. Please check your order confirmation email.'}
          </p>
          <Button asChild>
            <Link href="/products">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    )
  }

  const StatusIcon = STATUS_ICONS[order.status as keyof typeof STATUS_ICONS] || Clock
  const statusColor = STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.PENDING

  // Timeline stages
  const timelineStages = [
    {
      label: 'Order Placed',
      completed: true,
      date: order.createdAt,
      icon: CheckCircle2,
    },
    {
      label: 'Processing',
      completed: ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status),
      date: order.createdAt,
      icon: Package,
    },
    {
      label: 'Shipped',
      completed: ['SHIPPED', 'DELIVERED'].includes(order.status),
      date: order.shippedAt,
      icon: Truck,
    },
    {
      label: 'Delivered',
      completed: order.status === 'DELIVERED',
      date: order.deliveredAt,
      icon: Home,
    },
  ]

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Track Your Order</h1>
              <p className="text-neutral-600">Order #{order.orderNumber}</p>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${statusColor}`}>
              <StatusIcon className="w-5 h-5" />
              <span className="font-medium capitalize">{order.status.toLowerCase()}</span>
            </div>
          </div>

          {/* Order Timeline */}
          <div className="mt-8">
            <h2 className="font-semibold text-lg mb-6">Order Progress</h2>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-8 bottom-8 w-0.5 bg-neutral-200" />
              
              <div className="space-y-6">
                {timelineStages.map((stage) => {
                  const Icon = stage.icon
                  return (
                    <div key={stage.label} className="relative flex items-start gap-4">
                      {/* Icon */}
                      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                        stage.completed 
                          ? 'bg-green-600 text-white' 
                          : 'bg-neutral-200 text-neutral-400'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 pt-0.5">
                        <p className={`font-medium ${stage.completed ? 'text-black' : 'text-neutral-400'}`}>
                          {stage.label}
                        </p>
                        {stage.completed && stage.date && (
                          <p className="text-sm text-neutral-500 mt-0.5">
                            {new Date(stage.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Tracking Information */}
        {order.trackingNumber && (
          <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 mb-6">
            <h2 className="font-semibold text-lg mb-4">Shipping Information</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-neutral-600 mb-1">Tracking Number</p>
                <p className="font-mono text-lg font-medium">{order.trackingNumber}</p>
              </div>
              
              {order.carrier && (
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Carrier</p>
                  <p className="text-lg font-medium">{order.carrier}</p>
                </div>
              )}
              
              {order.estimatedDelivery && (
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Estimated Delivery</p>
                  <p className="text-lg font-medium">
                    {new Date(order.estimatedDelivery).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>

            {order.trackingUrl && (
              <div className="mt-6">
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  Track on {order.carrier || 'Carrier'} Website
                </a>
              </div>
            )}
          </div>
        )}

        {/* Shipping Address */}
        <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 mb-6">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Shipping Address
          </h2>
          <div className="text-neutral-700">
            <p className="font-medium">
              {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            </p>
            <p>{order.shippingAddress.address1}</p>
            {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
            </p>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 mb-6">
          <h2 className="font-semibold text-lg mb-4">Order Items</h2>
          <div className="space-y-4">
            {order.items.map((item) => {
              const variantInfo = item.variantDetails ? JSON.parse(item.variantDetails) : null
              return (
                <div key={item.id} className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0">
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

          {/* Price Summary */}
          <div className="mt-6 pt-6 border-t space-y-2">
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

        {/* Help Section */}
        <div className="bg-neutral-100 rounded-lg p-6 text-center">
          <p className="text-neutral-700 mb-4">
            Questions about your order or need help?
          </p>
          <Button asChild variant="outline">
            <Link href="/contact">Contact Support</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
