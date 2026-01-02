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

const STATUS_COLORS = {
  PENDING: 'bg-gray-100 text-gray-700 border-gray-200',
  PROCESSING: 'bg-gray-100 text-gray-700 border-gray-200',
  SHIPPED: 'bg-green-50 text-green-600 border-green-200',
  DELIVERED: 'bg-green-50 text-green-600 border-green-200',
  CANCELLED: 'bg-red-50 text-red-600 border-red-200',
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <CircleNotch size={48} weight="bold" className="animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-gray-500 font-mono text-sm uppercase tracking-wide">Loading Order...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center py-12 px-4">
        <div className="max-w-2xl w-full bg-white rounded-lg p-8 text-center border border-gray-200">
          <Warning size={64} weight="bold" className="text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-2 text-black uppercase tracking-tight">Order Not Found</h1>
          <p className="text-gray-500 mb-6">
            {error || 'We couldn\'t find an order with this ID. Please check your order confirmation email.'}
          </p>
          <Button asChild className="bg-black hover:bg-gray-900 text-white font-black uppercase tracking-wide">
            <Link href="/products">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    )
  }

  const StatusIcon = STATUS_ICONS[order.status as keyof typeof STATUS_ICONS] || Clock
  const statusColor = STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.PENDING

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
    <div className="min-h-screen bg-white py-6 px-4 text-black">
      <div className="max-w-7xl mx-auto">
        {/* Back Button & Header */}
        <div className="mb-6">
          <Link 
            href="/profile"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-4 group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" className="group-hover:-translate-x-1 transition-transform">
              <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path>
            </svg>
            <span className="font-bold text-sm uppercase tracking-wider">Back to Profile</span>
          </Link>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-black">
                    ORDER
                  </h1>
                  <div className="px-4 py-2 bg-gray-100 rounded-lg border border-gray-200">
                    <span className="text-2xl font-mono font-black text-black">#{order.orderNumber}</span>
                  </div>
                </div>
                <p className="text-gray-600 font-medium">{order.customerEmail}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Placed {new Date(order.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-black tracking-wider border ${statusColor}`}>
                <StatusIcon className="w-5 h-5" weight="bold" />
                <span className="uppercase text-sm">{order.status}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Redesigned Layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Timeline */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* Timeline */}
              <div className="relative bg-white rounded-lg p-6 border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Clock size={20} weight="bold" className="text-gray-700" />
                  </div>
                  <h2 className="font-black text-xl text-black tracking-tight uppercase">Timeline</h2>
                </div>

                <div className="relative">
                  <div className="absolute left-[15px] top-8 bottom-8 w-0.5 bg-gray-200" />

                  <div className="space-y-6">
                    {timelineStages.map((stage) => {
                      const Icon = stage.icon
                      return (
                        <div key={stage.label} className="relative flex items-start gap-4">
                          <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center z-10 transition-all duration-300 ${
                            stage.completed 
                              ? 'bg-black text-white scale-110' 
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>
                            <Icon className="w-4 h-4" weight="bold" />
                          </div>

                          <div className="flex-1 pt-1">
                            <p className={`font-bold text-sm mb-1 ${stage.completed ? 'text-black' : 'text-gray-600'} tracking-wide uppercase`}>
                              {stage.label}
                            </p>
                            {stage.completed && stage.date && (
                              <p className="text-xs text-gray-500 font-medium">
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

              {/* Shipping Address */}
              <div className="relative bg-neutral-900 rounded-2xl shadow-2xl p-6 border border-neutral-800 overflow-hidden">
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 blur-3xl" />
                
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/50">
                    <MapPin size={20} weight="bold" className="text-white" />
                  </div>
                  <h2 className="font-black text-xl text-white tracking-tight uppercase">Shipping</h2>
                </div>
                
                <div className="text-sm text-neutral-300 bg-neutral-800/50 rounded-xl p-4 space-y-1 border border-neutral-700">
                  <p className="font-black text-white text-base mb-2">
                    {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                  </p>
                  <p className="font-medium">{order.shippingAddress.address1}</p>
                  {order.shippingAddress.address2 && <p className="font-medium">{order.shippingAddress.address2}</p>}
                  <p className="font-medium">
                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                  </p>
                </div>
              </div>

              {/* Tracking Info */}
              {order.trackingNumber && (
                <div className="relative bg-neutral-900 rounded-2xl shadow-2xl p-6 border border-neutral-800 overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 blur-3xl" />
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/50">
                      <Package size={20} weight="bold" className="text-white" />
                    </div>
                    <h2 className="font-black text-xl text-black tracking-tight uppercase">Tracking</h2>
                    </div>

                    <div className="space-y-3">
                      <div className="relative bg-gray-50 rounded-xl p-3 border border-gray-200 overflow-hidden">
                        <p className="text-xs text-gray-500 mb-1 font-bold uppercase tracking-wider">Tracking #</p>
                        <p className="font-mono text-base font-black text-black">{order.trackingNumber}</p>
                      </div>

                      {order.carrier && (
                        <div className="relative bg-gray-50 rounded-xl p-3 border border-gray-200 overflow-hidden">
                          <p className="text-xs text-gray-500 mb-1 font-bold uppercase tracking-wider">Carrier</p>
                          <p className="text-base font-black text-black">{order.carrier}</p>
                        </div>
                      )}

                      {order.estimatedDelivery && (
                        <div className="relative bg-gray-50 rounded-xl p-3 border border-gray-200 overflow-hidden">
                          <p className="text-xs text-gray-500 mb-1 font-bold uppercase tracking-wider">Est. Delivery</p>
                          <p className="text-base font-black text-black">
                            {new Date(order.estimatedDelivery).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
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
                        className="inline-flex items-center justify-center gap-2 w-full mt-4 px-6 py-3 bg-black text-white rounded-lg transition-all text-sm font-black tracking-wider uppercase border border-gray-200"
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
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <div className="relative bg-white rounded-lg p-6 border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Package size={20} weight="bold" className="text-gray-700" />
                  </div>
                  <h2 className="font-black text-xl text-black tracking-tight uppercase">Items</h2>
                </div>
                <span className="px-3 py-1 rounded-lg bg-gray-100 border border-gray-200 text-black font-black text-sm">
                  {order.items.length}
                </span>
              </div>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {order.items.map((item) => {
                  const variantInfo = item.variantDetails ? JSON.parse(item.variantDetails) : null
                  const productSlug = item.product?.slug || ''
                  const imageUrl = getProductImage(item)
                  const hasValidImage = 
                    typeof imageUrl === 'string' && 
                    imageUrl.trim() !== '' && 
                    imageUrl !== '/placeholder-product.jpg'
                  
                  return (
                    <div key={item.id} className="group relative">
                      <Link 
                        href={productSlug ? `/products/${productSlug}` : '#'}
                        className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-300"
                      >
                        {/* Product Image */}
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-50 shrink-0 border border-gray-200 group-hover:border-gray-300 transition-all flex items-center justify-center">
                          {hasValidImage && typeof imageUrl === 'string' ? (
                            <img
                              src={imageUrl}
                              alt={item.productName}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
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
                            <Package size={32} className="text-gray-400" />
                          )}
                        </div>
                        
                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-black group-hover:text-gray-800 transition-colors line-clamp-2 mb-2">
                            {item.productName}
                          </h3>
                          
                          {/* Variant Information */}
                          {(variantInfo || item.productVariant) && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {(variantInfo?.size || item.productVariant?.size) && (
                                <span className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-bold border border-gray-200">
                                  {variantInfo?.size || item.productVariant?.size}
                                </span>
                              )}
                              {(variantInfo?.color || item.productVariant?.color) && (
                                <span className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-bold border border-gray-200">
                                  {variantInfo?.color || item.productVariant?.color}
                                </span>
                              )}
                            </div>
                          )}
                          
                          {/* Quantity & Price */}
                            <div className="flex items-center justify-between mt-3">
                            <span className="text-sm text-gray-600 font-medium">
                              Qty: <span className="text-black font-black">{item.quantity}</span>
                            </span>
                            <span className="text-lg font-black text-black">
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
            <div className="relative bg-white rounded-lg p-6 border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" className="text-gray-700">
                    <path d="M200,168a8,8,0,0,1-8,8H136v16a8,8,0,0,1-16,0V176H64a8,8,0,0,1,0-16h56V144a8,8,0,0,1,16,0v16h56A8,8,0,0,1,200,168Zm-72-40a8,8,0,0,0,8-8V104h56a8,8,0,0,0,0-16H136V72a8,8,0,0,0-16,0V88H64a8,8,0,0,0,0,16h56v16A8,8,0,0,0,128,128Zm104,0A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"></path>
                  </svg>
                </div>
                <h2 className="font-black text-xl text-black tracking-tight uppercase">Summary</h2>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600 font-medium">Subtotal</span>
                  <span className="font-black text-black text-lg">${order.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600 font-medium">Shipping</span>
                  <span className="font-black text-black text-lg">
                    {order.shipping === 0 ? (
                      <span className="text-green-600 font-black">FREE</span>
                    ) : (
                      `$${order.shipping.toFixed(2)}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600 font-medium">Tax</span>
                  <span className="font-black text-black text-lg">${order.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-4 mt-2">
                  <span className="text-black font-black text-xl uppercase tracking-wider">Total</span>
                  <span className="font-black text-black text-2xl">
                    ${order.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Help Section */}
            <div className="relative bg-gray-50 rounded-lg p-6 border border-gray-200 overflow-hidden">
              <div className="relative z-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className="text-gray-700">
                    <path d="M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"></path>
                  </svg>
                </div>
                <h3 className="font-black text-lg mb-2 text-black uppercase tracking-wide">Need Help?</h3>
                <p className="text-gray-600 mb-4 text-sm">Questions about your order?</p>
                <div className="flex flex-col gap-2">
                  <Button asChild className="bg-black text-white font-black uppercase tracking-wider">
                    <Link href="/contact">Contact Us</Link>
                  </Button>
                  <Button asChild variant="outline" className="border-2 border-gray-200 text-black hover:bg-gray-100 font-black uppercase tracking-wider">
                    <Link href="/products">Shop More</Link>
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
