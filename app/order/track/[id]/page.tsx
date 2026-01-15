'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Package, Truck, House, Clock, Warning, ArrowSquareOut, CircleNotch, MapPin } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

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

const STATUS_ICONS = {
  PENDING: Clock,
  PROCESSING: Package,
  SHIPPED: Truck,
  DELIVERED: House,
  CANCELLED: Warning,
}

// Modern status colors matching the site's tier color system
const STATUS_COLORS = {
  PENDING: {
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    iconBg: 'bg-amber-400/30',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  PROCESSING: {
    gradient: 'from-blue-500 via-blue-600 to-indigo-700',
    iconBg: 'bg-blue-400/30',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  SHIPPED: {
    gradient: 'from-emerald-500 via-green-500 to-teal-600',
    iconBg: 'bg-emerald-400/30',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  DELIVERED: {
    gradient: 'from-purple-500 via-violet-500 to-purple-700',
    iconBg: 'bg-purple-400/30',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  CANCELLED: {
    gradient: 'from-rose-500 via-red-500 to-rose-600',
    iconBg: 'bg-rose-400/30',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
  },
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
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="text-center">
          <CircleNotch size={48} weight="bold" className="animate-spin text-black mx-auto mb-4" />
          <p className="text-black/50 font-medium text-sm">Loading Order...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center shadow-sm border border-black/5">
          <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Warning size={32} weight="fill" className="text-rose-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-black">Order Not Found</h1>
          <p className="text-black/50 mb-6">
            {error || "We couldn't find an order with this ID. Please check your order confirmation email."}
          </p>
          <Button asChild className="bg-black hover:bg-black/90 text-white font-medium rounded-xl px-6 py-3">
            <Link href="/products">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    )
  }

  const StatusIcon = STATUS_ICONS[order.status as keyof typeof STATUS_ICONS] || Clock
  const statusColors = STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.PENDING

  // Helper function to get product image
  const getProductImage = (item: OrderItem): string => {
    console.log('Getting image for item:', {
      productName: item.productName,
      productImage: item.productImage,
      productImages: item.product?.images,
      productImagesType: typeof item.product?.images,
      isArray: Array.isArray(item.product?.images)
    })
    
    // Try to get from product.images first (from live product data)
    if (item.product?.images) {
      // Handle array of images
      if (Array.isArray(item.product.images) && item.product.images.length > 0) {
        const firstImage = item.product.images[0]
        console.log('Using array image:', firstImage)
        return firstImage
      }
      
      // Handle string (could be JSON or URL)
      if (typeof item.product.images === 'string') {
        // Try parsing if it's a JSON string
        if (item.product.images.startsWith('[') || item.product.images.startsWith('{')) {
          try {
            const parsed = JSON.parse(item.product.images)
            let imageUrl = null
            
            if (Array.isArray(parsed)) {
              // Handle array of image objects or strings
              const firstItem = parsed[0]
              imageUrl = typeof firstItem === 'object' && firstItem.url ? firstItem.url : firstItem
            } else if (typeof parsed === 'object' && parsed.url) {
              // Handle single image object with url property
              imageUrl = parsed.url
            } else {
              imageUrl = parsed
            }
            
            if (imageUrl && typeof imageUrl === 'string') {
              console.log('Using parsed image URL:', imageUrl)
              return imageUrl
            }
          } catch (e) {
            console.error('Failed to parse JSON:', e)
            // Not valid JSON, check if it's a URL
            if (item.product.images.startsWith('http') || item.product.images.startsWith('/')) {
              console.log('Using string URL image:', item.product.images)
              return item.product.images
            }
          }
        } else if (item.product.images.startsWith('http') || item.product.images.startsWith('/')) {
          // Already a URL
          console.log('Using direct URL image:', item.product.images)
          return item.product.images
        }
      }
    }
    
    // Fallback to productImage from order snapshot
    if (item.productImage) {
      console.log('Using productImage snapshot:', item.productImage)
      return item.productImage
    }
    
    // Final fallback to placeholder
    console.log('Using placeholder - no image found')
    return '/placeholder-product.jpg'
  }

  // Timeline stages
  const timelineStages = [
    {
      label: 'Order Placed',
      completed: true,
      date: order.createdAt,
      icon: CheckCircle,
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
      icon: House,
    },
  ]

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-8 px-4 text-black">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <Link 
          href="/profile"
          className="inline-flex items-center gap-2 text-black/50 hover:text-black transition-colors mb-6 group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" className="group-hover:-translate-x-1 transition-transform">
            <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path>
          </svg>
          <span className="font-medium text-sm">Back to Profile</span>
        </Link>

        {/* Order Header Card - Modern Gradient Style */}
        <div className={`bg-linear-to-br ${statusColors.gradient} rounded-2xl p-6 text-white shadow-xl relative overflow-hidden mb-6`}>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-lg" />
          
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 ${statusColors.iconBg} rounded-xl flex items-center justify-center`}>
                  <StatusIcon size={24} weight="fill" className="text-white" />
                </div>
                <div>
                  <p className="text-white/70 text-sm font-medium">Order</p>
                  <h1 className="text-2xl md:text-3xl font-bold">#{order.orderNumber}</h1>
                </div>
              </div>
              <p className="text-white/80 text-sm">{order.customerEmail}</p>
              <p className="text-white/60 text-xs mt-1">
                Placed {new Date(order.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-4 py-2 rounded-xl text-sm font-semibold border ${statusColors.badge}`}>
                {order.status}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content - Modern Layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Timeline */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              {/* Timeline */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-black/5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center">
                    <Clock size={20} weight="fill" className="text-black/60" />
                  </div>
                  <h2 className="font-bold text-lg text-black">Order Timeline</h2>
                </div>

                <div className="relative">
                  <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-black/10" />

                  <div className="space-y-4">
                    {timelineStages.map((stage) => {
                      const Icon = stage.icon
                      return (
                        <div key={stage.label} className="relative flex items-start gap-4">
                          <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center z-10 transition-all duration-300 ${
                            stage.completed 
                              ? 'bg-black text-white' 
                              : 'bg-black/5 text-black/40'
                          }`}>
                            <Icon className="w-4 h-4" weight="fill" />
                          </div>

                          <div className="flex-1 pt-1">
                            <p className={`font-semibold text-sm ${stage.completed ? 'text-black' : 'text-black/40'}`}>
                              {stage.label}
                            </p>
                            {stage.completed && stage.date && (
                              <p className="text-xs text-black/50 mt-0.5">
                                {new Date(stage.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </p>
                            )}
                          </div>
                          
                          {stage.completed && (
                            <CheckCircle size={16} weight="fill" className="text-emerald-500 mt-1" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-black/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <MapPin size={20} weight="fill" className="text-blue-600" />
                  </div>
                  <h2 className="font-bold text-lg text-black">Shipping Address</h2>
                </div>
                
                <div className="text-sm text-black/60 bg-black/2 rounded-xl p-4 border border-black/5">
                  <p className="font-semibold text-black mb-2">
                    {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                  </p>
                  <p>{order.shippingAddress.address1}</p>
                  {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
                  <p>
                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                  </p>
                </div>
              </div>

              {/* Tracking Info */}
              {order.trackingNumber && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-black/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <Truck size={20} weight="fill" className="text-emerald-600" />
                    </div>
                    <h2 className="font-bold text-lg text-black">Tracking Info</h2>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-black/2 rounded-xl p-3 border border-black/5">
                      <p className="text-xs text-black/50 mb-1">Tracking Number</p>
                      <p className="font-mono text-sm font-semibold text-black">{order.trackingNumber}</p>
                    </div>

                    {order.carrier && (
                      <div className="bg-black/2 rounded-xl p-3 border border-black/5">
                        <p className="text-xs text-black/50 mb-1">Carrier</p>
                        <p className="text-sm font-semibold text-black">{order.carrier}</p>
                      </div>
                    )}

                    {order.estimatedDelivery && (
                      <div className="bg-black/2 rounded-xl p-3 border border-black/5">
                        <p className="text-xs text-black/50 mb-1">Estimated Delivery</p>
                        <p className="text-sm font-semibold text-black">
                          {new Date(order.estimatedDelivery).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    )}
                  </div>

                  {order.trackingUrl && (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full mt-4 px-4 py-3 bg-black text-white rounded-xl transition-all text-sm font-medium hover:bg-black/90"
                    >
                      <ArrowSquareOut size={18} weight="bold" />
                      Track Package
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Order Items & Summary */}
          <div className="lg:col-span-2 space-y-4">
            {/* Order Items */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center">
                    <Package size={20} weight="fill" className="text-black/60" />
                  </div>
                  <h2 className="font-bold text-lg text-black">Order Items</h2>
                </div>
                <span className="px-3 py-1 rounded-lg bg-black/5 text-black/60 font-semibold text-sm">
                  {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {order.items.map((item) => {
                  const variantInfo = item.variantDetails ? JSON.parse(item.variantDetails) : null
                  const productSlug = item.product?.slug || ''
                  const imageUrl = getProductImage(item)
                  const hasValidImage = 
                    typeof imageUrl === 'string' && 
                    imageUrl.trim() !== '' && 
                    imageUrl !== '/placeholder-product.jpg'
                  
                  return (
                    <div key={item.id} className="group">
                      <Link 
                        href={productSlug ? `/products/${productSlug}` : '#'}
                        className="flex gap-4 p-4 bg-black/2 rounded-xl border border-black/5 hover:border-black/10 hover:bg-black/4 transition-all duration-200"
                      >
                        {/* Product Image */}
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white shrink-0 border border-black/5 flex items-center justify-center">
                          {hasValidImage && typeof imageUrl === 'string' ? (
                            <img
                              src={imageUrl}
                              alt={item.productName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                const parent = target.parentElement
                                if (parent && !parent.querySelector('.fallback-icon')) {
                                  const icon = document.createElement('div')
                                  icon.className = 'fallback-icon absolute inset-0 flex items-center justify-center'
                                  icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#737373" viewBox="0 0 256 256"><path d="M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,120,47.65,76,128,32l80.35,44Zm8,99.64V133.83l80-43.78v85.76Z"></path></svg>'
                                  parent.appendChild(icon)
                                }
                              }}
                            />
                          ) : (
                            <Package size={28} className="text-black/20" />
                          )}
                        </div>
                        
                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-black group-hover:text-black/80 transition-colors line-clamp-2 text-sm mb-2">
                            {item.productName}
                          </h3>
                          
                          {/* Variant Information */}
                          {(variantInfo || item.productVariant) && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {(variantInfo?.size || item.productVariant?.size) && (
                                <span className="text-xs px-2 py-0.5 rounded-md bg-white text-black/60 font-medium border border-black/10">
                                  {variantInfo?.size || item.productVariant?.size}
                                </span>
                              )}
                              {(variantInfo?.color || item.productVariant?.color) && (
                                <span className="text-xs px-2 py-0.5 rounded-md bg-white text-black/60 font-medium border border-black/10">
                                  {variantInfo?.color || item.productVariant?.color}
                                </span>
                              )}
                            </div>
                          )}
                          
                          {/* Quantity & Price */}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-black/50">
                              Qty: <span className="text-black font-semibold">{item.quantity}</span>
                            </span>
                            <span className="text-base font-bold text-black">
                              ${(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Price Summary */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-black/5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" className="text-black/60">
                    <path d="M200,168a8,8,0,0,1-8,8H136v16a8,8,0,0,1-16,0V176H64a8,8,0,0,1,0-16h56V144a8,8,0,0,1,16,0v16h56A8,8,0,0,1,200,168Zm-72-40a8,8,0,0,0,8-8V104h56a8,8,0,0,0,0-16H136V72a8,8,0,0,0-16,0V88H64a8,8,0,0,0,0,16h56v16A8,8,0,0,0,128,128Zm104,0A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"></path>
                  </svg>
                </div>
                <h2 className="font-bold text-lg text-black">Order Summary</h2>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2">
                  <span className="text-black/50 text-sm">Subtotal</span>
                  <span className="font-semibold text-black">${order.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-black/50 text-sm">Shipping</span>
                  <span className="font-semibold text-black">
                    {order.shipping === 0 ? (
                      <span className="text-emerald-600">FREE</span>
                    ) : (
                      `$${order.shipping.toFixed(2)}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-black/50 text-sm">Tax</span>
                  <span className="font-semibold text-black">${order.tax.toFixed(2)}</span>
                </div>
                <div className="border-t border-black/10 pt-4 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-black font-bold text-lg">Total</span>
                    <span className="font-bold text-black text-xl">
                      ${order.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Help Section */}
            <div className="bg-black/2 rounded-2xl p-5 border border-black/5">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className="text-black/50">
                    <path d="M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"></path>
                  </svg>
                </div>
                <h3 className="font-bold text-base mb-1 text-black">Need Help?</h3>
                <p className="text-black/50 mb-4 text-sm">Questions about your order?</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button asChild className="bg-black text-white font-medium rounded-xl hover:bg-black/90">
                    <Link href="/contact">Contact Us</Link>
                  </Button>
                  <Button asChild variant="outline" className="border border-black/10 text-black hover:bg-black/5 font-medium rounded-xl">
                    <Link href="/products">Continue Shopping</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
