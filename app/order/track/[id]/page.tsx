'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { 
  CheckCircle, 
  Package, 
  Truck, 
  House, 
  Clock, 
  Warning, 
  ArrowSquareOut, 
  CircleNotch, 
  MapPin, 
  ArrowLeft,
  CopySimple,
  Check,
  X,
  CaretDown,
  CaretUp
} from '@phosphor-icons/react'
import { TrackingMap } from '@/components/orders/TrackingMap'
import type { TrackingResult } from '@/lib/shipping/tracking'

interface OrderItem {
  id: string
  productName: string
  productImage: string | null
  quantity: number
  price: number
  variantDetails: string | null
  product?: {
    name: string
    slug: string
    images: string | string[]
  }
  productVariant?: {
    size?: string | null
    color?: string | null
  } | null
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

const STEPS = [
  { key: 'ordered', label: 'Order Placed', icon: CheckCircle },
  { key: 'processing', label: 'Processing', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: House },
]

function getStepStatus(orderStatus: string, stepKey: string): 'complete' | 'current' | 'upcoming' {
  const statusMap: Record<string, number> = {
    PENDING: 0,
    CONFIRMED: 0,
    PROCESSING: 1,
    SHIPPED: 2,
    DELIVERED: 3,
  }
  const stepMap: Record<string, number> = {
    ordered: 0,
    processing: 1,
    shipped: 2,
    delivered: 3,
  }
  
  const currentStep = statusMap[orderStatus] ?? 0
  const thisStep = stepMap[stepKey] ?? 0
  
  if (thisStep < currentStep) return 'complete'
  if (thisStep === currentStep) return 'current'
  return 'upcoming'
}

export default function OrderTrackingPage() {
  const params = useParams()
  const orderId = params.id as string
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trackingData, setTrackingData] = useState<TrackingResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(false)

  useEffect(() => {
    if (!orderId) return
    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`)
        if (!response.ok) throw new Error(response.status === 404 ? 'Order not found' : 'Failed to fetch order')
        const data = await response.json()
        setOrder(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order')
      } finally {
        setLoading(false)
      }
    }
    fetchOrder()
  }, [orderId])

  const fetchTrackingData = useCallback(async () => {
    if (!orderId) return
    try {
      const response = await fetch(`/api/orders/${orderId}/tracking/live`)
      if (response.ok) {
        const result = await response.json()
        if (result.hasTracking && result.data) setTrackingData(result.data)
      }
    } catch (err) {
      console.error('Error fetching tracking:', err)
    }
  }, [orderId])

  useEffect(() => {
    if (order?.trackingNumber) fetchTrackingData()
  }, [order?.trackingNumber, fetchTrackingData])

  const copyTracking = () => {
    if (order?.trackingNumber) {
      navigator.clipboard.writeText(order.trackingNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getProductImage = (item: OrderItem): string | null => {
    if (item.product?.images) {
      if (Array.isArray(item.product.images) && item.product.images.length > 0) {
        return item.product.images[0]
      }
      if (typeof item.product.images === 'string') {
        try {
          const parsed = JSON.parse(item.product.images)
          if (Array.isArray(parsed) && parsed.length > 0) {
            const first = parsed[0]
            return typeof first === 'object' && first.url ? first.url : first
          }
        } catch {
          if (item.product.images.startsWith('http')) return item.product.images
        }
      }
    }
    return item.productImage
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <Warning size={48} weight="bold" className="text-black/30 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-black mb-2">Order Not Found</h1>
          <p className="text-black/60 mb-6">{error || "We couldn't find this order."}</p>
          <Link href="/orders" className="inline-block px-6 py-3 bg-black text-white font-semibold hover:bg-black/90 transition-colors">
            View All Orders
          </Link>
        </div>
      </div>
    )
  }

  const isCancelled = order.status === 'CANCELLED'
  const hasTracking = order.trackingNumber && trackingData
  const latestEvent = trackingData?.events?.[0]

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Back Link */}
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-black/60 hover:text-black transition-colors mb-8 group"
        >
          <ArrowLeft size={20} weight="bold" className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">All Orders</span>
        </Link>

        {/* Order Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-black text-black">Order {order.orderNumber}</h1>
              <p className="text-black/60 mt-1">
                Placed {new Date(order.createdAt).toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </p>
            </div>
            <p className="text-3xl font-black text-black">${order.total.toFixed(2)}</p>
          </div>
        </div>

        {/* Progress Tracker - The Main Focus */}
        {!isCancelled && (
          <div className="bg-white border border-black/10 p-6 sm:p-8 mb-6">
            <h2 className="text-lg font-bold text-black mb-6">Where&apos;s My Order?</h2>
            
            {/* Simple Horizontal Progress */}
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-5 left-0 right-0 h-1 bg-black/10" />
              <div 
                className="absolute top-5 left-0 h-1 bg-black transition-all duration-500"
                style={{
                  width: order.status === 'DELIVERED' ? '100%' : 
                         order.status === 'SHIPPED' ? '66%' : 
                         order.status === 'PROCESSING' ? '33%' : '0%'
                }}
              />
              
              {/* Steps */}
              <div className="relative flex justify-between">
                {STEPS.map((step) => {
                  const status = getStepStatus(order.status, step.key)
                  const Icon = step.icon
                  const isComplete = status === 'complete'
                  const isCurrent = status === 'current'
                  
                  return (
                    <div key={step.key} className="flex flex-col items-center">
                      <div 
                        className={`
                          w-10 h-10 flex items-center justify-center transition-all
                          ${isComplete || isCurrent ? 'bg-black text-white' : 'bg-white border-2 border-black/20 text-black/30'}
                          ${isCurrent ? 'ring-4 ring-black/10' : ''}
                        `}
                      >
                        <Icon size={20} weight={isComplete ? 'fill' : 'bold'} />
                      </div>
                      <span className={`
                        mt-3 text-xs sm:text-sm font-medium text-center
                        ${isComplete || isCurrent ? 'text-black' : 'text-black/40'}
                      `}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Status Message with Integrated Map & History */}
            <div className="mt-8 pt-6 border-t border-black/10">
              {/* Shipped/Delivered with tracking - show map and collapsible history */}
              {hasTracking && (order.status === 'SHIPPED' || order.status === 'DELIVERED') ? (
                <div className="flex gap-6">
                  {/* Left: Status Info & Collapsible History */}
                  <div className="flex-1 min-w-0">
                    {/* Current Status */}
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${
                        order.status === 'DELIVERED' ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        {order.status === 'DELIVERED' ? (
                          <CheckCircle size={20} weight="fill" className="text-green-600" />
                        ) : (
                          <Truck size={20} weight="fill" className="text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-black">
                          {order.status === 'DELIVERED' 
                            ? 'Delivered!' 
                            : latestEvent?.description || 'On the way!'}
                        </p>
                        <p className="text-black/60 text-sm mt-0.5">
                          {order.status === 'DELIVERED' 
                            ? `Your package was delivered${order.deliveredAt ? ` on ${new Date(order.deliveredAt).toLocaleDateString()}` : ''}`
                            : latestEvent 
                              ? `${latestEvent.location.city}, ${latestEvent.location.state} • ${new Date(latestEvent.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                              : 'Your package is in transit'}
                        </p>
                        {order.status === 'SHIPPED' && trackingData.estimatedDelivery && (
                          <p className="text-green-600 text-sm font-medium mt-1">
                            Expected delivery: {new Date(trackingData.estimatedDelivery).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Collapsible History Toggle */}
                    {trackingData.events.length > 1 && (
                      <div className="mt-4">
                        <button
                          onClick={() => setHistoryExpanded(!historyExpanded)}
                          className="flex items-center gap-2 text-sm text-black/60 hover:text-black transition-colors"
                        >
                          {historyExpanded ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />}
                          <span>{historyExpanded ? 'Hide' : 'Show'} tracking history ({trackingData.events.length} updates)</span>
                        </button>
                        
                        {/* Collapsible History Content */}
                        {historyExpanded && (
                          <div className="mt-4 pl-4 border-l-2 border-black/10 space-y-3">
                            {trackingData.events.slice(1).map((event, idx) => (
                              <div key={idx} className="text-sm">
                                <p className="text-black/70">{event.description}</p>
                                <p className="text-black/40 text-xs">
                                  {event.location.city}, {event.location.state} • {new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Map (wider) */}
                  <div className="flex-shrink-0 w-48 h-28 md:w-64 md:h-36 border border-black/10 overflow-hidden cursor-pointer group relative"
                    onClick={() => setMapModalOpen(true)}
                  >
                    <TrackingMap
                      origin={trackingData.originLocation}
                      destination={trackingData.destinationLocation}
                      currentLocation={trackingData.currentLocation}
                      events={trackingData.events}
                      status={trackingData.status}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">Expand</span>
                    </div>
                  </div>
                </div>
              ) : order.status === 'PROCESSING' ? (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Package size={20} weight="fill" className="text-purple-600" />
                  </div>
                  <div>
                    <p className="font-bold text-black">We&apos;re packing your order</p>
                    <p className="text-black/60 text-sm mt-0.5">It should ship within 1-2 business days</p>
                  </div>
                </div>
              ) : order.status === 'PENDING' ? (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Clock size={20} weight="fill" className="text-amber-600" />
                  </div>
                  <div>
                    <p className="font-bold text-black">Order received</p>
                    <p className="text-black/60 text-sm mt-0.5">We&apos;ll start processing it soon</p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Tracking Number */}
            {order.trackingNumber && (
              <div className="mt-6 pt-6 border-t border-black/10">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs text-black/50 uppercase tracking-wider font-medium mb-1">Tracking Number</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono font-medium text-black">{order.trackingNumber}</code>
                      <button 
                        onClick={copyTracking}
                        className="p-1.5 hover:bg-black/5 transition-colors"
                        title="Copy tracking number"
                      >
                        {copied ? (
                          <Check size={16} weight="bold" className="text-green-600" />
                        ) : (
                          <CopySimple size={16} weight="bold" className="text-black/40" />
                        )}
                      </button>
                    </div>
                  </div>
                  {order.trackingUrl && (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-semibold hover:bg-black/90 transition-colors"
                    >
                      Track on {order.carrier || 'Carrier'}
                      <ArrowSquareOut size={16} weight="bold" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cancelled State */}
        {isCancelled && (
          <div className="bg-red-50 border border-red-200 p-6 mb-6">
            <div className="flex items-start gap-3">
              <Warning size={24} weight="fill" className="text-red-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-700">Order Cancelled</p>
                <p className="text-red-600 text-sm mt-1">This order has been cancelled. If you have questions, please contact support.</p>
              </div>
            </div>
          </div>
        )}

        {/* Two Column Layout: Items & Details */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Shipping & Summary (moved to left) */}
          <div className="space-y-6">
            {/* Shipping Address */}
            <div className="bg-white border border-black/10 p-6">
              <h2 className="text-lg font-bold text-black mb-3 flex items-center gap-2">
                <MapPin size={20} weight="fill" className="text-black/60" />
                Shipping To
              </h2>
              <div className="text-black/80">
                <p className="font-semibold text-black">
                  {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                </p>
                <p>{order.shippingAddress.address1}</p>
                {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-white border border-black/10 p-6">
              <h2 className="text-lg font-bold text-black mb-4">Order Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-black/60">Subtotal</span>
                  <span className="text-black">${order.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/60">Shipping</span>
                  <span className="text-black">{order.shipping === 0 ? 'Free' : `$${order.shipping.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/60">Tax</span>
                  <span className="text-black">${order.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-3 mt-3 border-t border-black/10">
                  <span className="font-bold text-black">Total</span>
                  <span className="font-bold text-black">${order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items (moved to right) */}
          <div className="bg-white border border-black/10 p-6">
            <h2 className="text-lg font-bold text-black mb-4">
              Items ({order.items.reduce((sum, i) => sum + i.quantity, 0)})
            </h2>
            <div className="space-y-4">
              {order.items.map((item) => {
                const imageUrl = getProductImage(item)
                // variantDetails is a plain string like "S Black" or "M Navy", not JSON
                const variantText = item.variantDetails || ''
                
                return (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-16 h-16 bg-black/5 flex-shrink-0 relative overflow-hidden">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={item.productName}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={24} weight="bold" className="text-black/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-black truncate">{item.productName}</p>
                      <p className="text-sm text-black/60">
                        {[
                          variantText || item.productVariant?.size,
                          !variantText && item.productVariant?.color,
                          `Qty: ${item.quantity}`
                        ].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                    <p className="font-bold text-black">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="text-black/60 mb-4">Need help with your order?</p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              href="/contact"
              className="px-6 py-3 border border-black/10 text-black font-semibold hover:bg-black/5 transition-colors"
            >
              Contact Support
            </Link>
            <Link
              href="/products"
              className="px-6 py-3 bg-black text-white font-semibold hover:bg-black/90 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>

      {/* Map Modal */}
      {mapModalOpen && hasTracking && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setMapModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-black/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-black">Live Tracking</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-sm text-black/60">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>Origin</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Package</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Destination</span>
                  </div>
                </div>
                <button 
                  className="p-2 hover:bg-black/5 transition-colors"
                  onClick={() => setMapModalOpen(false)}
                >
                  <X size={20} weight="bold" />
                </button>
              </div>
            </div>
            <div className="h-[400px]">
              <TrackingMap
                origin={trackingData.originLocation}
                destination={trackingData.destinationLocation}
                currentLocation={trackingData.currentLocation}
                events={trackingData.events}
                status={trackingData.status}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
