'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { 
  Package, 
  ArrowLeft, 
  CircleNotch, 
  Clock, 
  Check, 
  X, 
  Truck, 
  ShoppingBag,
  Eye,
  MapPin
} from '@phosphor-icons/react'

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'

interface OrderItem {
  id: string
  quantity: number
  price: number
  product: {
    id: string
    name: string
    slug: string
    images: string
  }
  productVariant?: {
    size?: string | null
    color?: string | null
  } | null
}

interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  total: number
  subtotal: number
  shipping: number
  tax: number
  discount: number
  createdAt: string
  shippedAt?: string | null
  deliveredAt?: string | null
  trackingNumber?: string | null
  items: OrderItem[]
  shippingAddress: {
    firstName: string
    lastName: string
    city: string
    state: string
  }
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  PENDING: {
    label: 'Pending',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-100',
  },
  CONFIRMED: {
    label: 'Confirmed',
    icon: Check,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
  PROCESSING: {
    label: 'Processing',
    icon: Package,
    color: 'text-purple-600',
    bg: 'bg-purple-100',
  },
  SHIPPED: {
    label: 'Shipped',
    icon: Truck,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100',
  },
  DELIVERED: {
    label: 'Delivered',
    icon: Check,
    color: 'text-green-600',
    bg: 'bg-green-100',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: X,
    color: 'text-red-600',
    bg: 'bg-red-100',
  },
  REFUNDED: {
    label: 'Refunded',
    icon: X,
    color: 'text-black/60',
    bg: 'bg-black/5',
  },
}

const DEFAULT_STATUS_CONFIG = {
  label: 'Unknown',
  icon: Clock,
  color: 'text-black/60',
  bg: 'bg-black/5',
}

export default function OrderHistory() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin?redirect=/orders')
      return
    }

    if (user?.email) {
      fetchOrders(user.email)
    }
  }, [user, authLoading, router])

  async function fetchOrders(email: string) {
    try {
      const response = await fetch('/api/orders', {
        headers: {
          'x-user-email': email,
        },
      })
      if (response.ok) {
        const result = await response.json()
        setOrders(result.data || [])
      } else {
        console.error('Failed to fetch orders:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const getImageUrl = (images: string): string | null => {
    try {
      const parsed = JSON.parse(images)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0]
        if (typeof first === 'string' && first.startsWith('http')) return first
        if (first?.url && first.url.startsWith('http')) return first.url
      }
    } catch {
      // If it's already a string URL
      if (typeof images === 'string' && images.startsWith('http')) return images
    }
    return null
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pt-20 sm:pt-24 pb-12 sm:pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-black/60 hover:text-black transition-colors mb-6 group"
        >
          <ArrowLeft size={20} weight="bold" className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Profile</span>
        </Link>

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black flex items-center justify-center">
              <Package size={20} weight="fill" className="text-white sm:hidden" />
              <Package size={24} weight="fill" className="text-white hidden sm:block" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-black">Order History</h1>
              <p className="text-sm sm:text-base text-black/60">View and track all your orders</p>
            </div>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white border border-black/10 p-12 text-center">
            <ShoppingBag size={64} weight="bold" className="text-black/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-black mb-2">No Orders Yet</h3>
            <p className="text-black/60 mb-6">
              You haven&apos;t placed any orders yet. Start shopping to see your orders here!
            </p>
            <Link
              href="/products"
              className="inline-block px-6 py-3 bg-black text-white font-semibold hover:bg-black/90 transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const statusConfig = STATUS_CONFIG[order.status] || DEFAULT_STATUS_CONFIG
              const StatusIcon = statusConfig.icon
              const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

              return (
                <div
                  key={order.id}
                  className="bg-white border border-black/10 overflow-hidden hover:border-black/20 transition-colors"
                >
                  {/* Order Header */}
                  <div className="p-4 sm:p-6 border-b border-black/5">
                    <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                          <h3 className="text-base sm:text-lg font-bold text-black">
                            {order.orderNumber}
                          </h3>
                          <div className={`px-3 py-1 ${statusConfig.bg} flex items-center gap-1.5`}>
                            <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} weight="bold" />
                            <span className={`text-xs font-semibold ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-black/60">
                          <span>
                            {new Date(order.createdAt).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span>•</span>
                          <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                          {order.shippingAddress && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <MapPin size={14} weight="bold" />
                                {order.shippingAddress.city}, {order.shippingAddress.state}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl sm:text-2xl font-black text-black">
                          ${order.total.toFixed(2)}
                        </p>
                        {order.discount > 0 && (
                          <p className="text-sm text-green-600 font-medium">
                            -${order.discount.toFixed(2)} discount
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div className="p-4 sm:p-6 bg-black/[0.02]">
                    <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-2">
                      {order.items.slice(0, 4).map((item) => {
                        const imageUrl = getImageUrl(item.product.images)
                        return (
                          <div key={item.id} className="flex-shrink-0">
                            <div className="relative w-16 h-16 bg-black/5 overflow-hidden">
                              {imageUrl ? (
                                <Image
                                  src={imageUrl}
                                  alt={item.product.name}
                                  fill
                                  className="object-cover"
                                  sizes="64px"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package size={24} weight="bold" className="text-black/30" />
                                </div>
                              )}
                              {item.quantity > 1 && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-black text-white text-[10px] font-bold flex items-center justify-center">
                                  {item.quantity}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {order.items.length > 4 && (
                        <div className="flex-shrink-0 w-16 h-16 bg-black/5 flex items-center justify-center">
                          <span className="text-sm font-bold text-black/60">
                            +{order.items.length - 4}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex-1" />
                      
                      {/* Actions */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {order.trackingNumber && (order.status === 'SHIPPED' || order.status === 'DELIVERED') && (
                          <Link
                            href={`/orders/${order.id}/track`}
                            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-semibold hover:bg-black/90 transition-colors"
                          >
                            <Truck size={16} weight="bold" />
                            Track Order
                          </Link>
                        )}
                        <Link
                          href={`/orders/${order.id}/track`}
                          className="flex items-center gap-2 px-4 py-2 border border-black/10 text-black text-sm font-semibold hover:bg-black/5 transition-colors"
                        >
                          <Eye size={16} weight="bold" />
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Info */}
                  {(order.shippedAt || order.deliveredAt) && (
                    <div className="px-6 py-3 bg-black/5 border-t border-black/5">
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        {order.shippedAt && (
                          <span className="text-black/60">
                            Shipped: {new Date(order.shippedAt).toLocaleDateString()}
                          </span>
                        )}
                        {order.deliveredAt && (
                          <span className="text-green-600 font-medium">
                            Delivered: {new Date(order.deliveredAt).toLocaleDateString()}
                          </span>
                        )}
                        {order.trackingNumber && (
                          <span className="text-black/60">
                            Tracking: <code className="font-mono">{order.trackingNumber}</code>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link
            href="/products"
            className="px-6 py-3 bg-black text-white font-semibold hover:bg-black/90 transition-colors"
          >
            Continue Shopping
          </Link>
          <Link
            href="/profile"
            className="px-6 py-3 bg-white border border-black/10 text-black font-semibold hover:bg-black/5 transition-colors"
          >
            Back to Profile
          </Link>
        </div>
      </div>
    </div>
  )
}
