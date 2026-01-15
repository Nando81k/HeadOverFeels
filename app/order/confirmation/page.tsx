'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { 
  CheckCircle, 
  Package, 
  EnvelopeSimple, 
  CircleNotch, 
  Star, 
  Truck,
  ArrowRight,
  MapPin,
  Receipt,
  Confetti,
  Heart,
  Coins,
  Gift
} from '@phosphor-icons/react'
import { Navigation } from '@/components/layout/Navigation'
import { useAuth } from '@/lib/auth/context'

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
  discount?: number
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
  pointsEarned?: number
  customerId?: string
}

function ConfirmationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
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
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <CircleNotch size={40} weight="bold" className="animate-spin text-black/30" />
            <p className="text-sm text-black/50">Loading your order...</p>
          </motion.div>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full text-center"
          >
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package size={32} weight="duotone" className="text-red-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Order Not Found</h2>
            <p className="text-black/60 mb-8">{error || 'We couldn\'t find your order details.'}</p>
            <Link 
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-semibold hover:bg-black/80 transition-all"
            >
              Continue Shopping
              <ArrowRight size={18} weight="bold" />
            </Link>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      <main className="pt-8 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Success Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
              className="relative inline-block mb-6"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                <CheckCircle size={48} weight="fill" className="text-white" />
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute -top-2 -right-2"
              >
                <Confetti size={28} weight="fill" className="text-amber-400" />
              </motion.div>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-5xl font-black mb-3"
              style={{ 
                WebkitTextStroke: '1.5px #1A1A1A',
                color: 'transparent'
              }}
            >
              ORDER CONFIRMED
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-black/60 mb-2"
            >
              Thank you for your purchase!
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 rounded-full"
            >
              <Receipt size={16} weight="bold" className="text-black/60" />
              <span className="text-sm font-mono font-semibold">{order.orderNumber}</span>
            </motion.div>
          </motion.div>

          {/* Care Points Earned Section - Show when user is authenticated and earned points */}
          {order.pointsEarned && order.pointsEarned > 0 && user && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.15, type: "spring", bounce: 0.4 }}
              className="mb-6"
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 rounded-3xl p-6 md:p-8">
                {/* Background decoration */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full blur-3xl" />
                  <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl" />
                </div>
                
                <div className="relative flex items-center gap-4 md:gap-6">
                  {/* Points Icon */}
                  <motion.div
                    initial={{ rotate: -10, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
                    className="shrink-0"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
                      <Coins size={36} weight="fill" className="text-white drop-shadow-lg" />
                    </div>
                  </motion.div>
                  
                  {/* Points Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-base text-white/80 font-medium mb-1">
                      You earned
                    </p>
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.4, type: "spring", bounce: 0.3 }}
                      className="flex items-baseline gap-2"
                    >
                      <span className="text-4xl md:text-5xl font-black text-white drop-shadow-lg">
                        +{order.pointsEarned}
                      </span>
                      <span className="text-lg md:text-xl font-bold text-white/90">
                        Care Points
                      </span>
                    </motion.div>
                    <p className="text-sm text-white/70 mt-1">
                      Added to your loyalty balance
                    </p>
                  </div>
                  
                  {/* Gift Icon decoration */}
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="hidden md:block"
                  >
                    <Gift size={32} weight="fill" className="text-white/40" />
                  </motion.div>
                </div>
                
                {/* View Rewards Link */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="relative mt-4 pt-4 border-t border-white/20"
                >
                  <Link
                    href="/loyalty/rewards"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/80 transition-colors"
                  >
                    View your rewards & redeem points
                    <ArrowRight size={16} weight="bold" />
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Sign Up CTA for Guest Users (no points earned and not signed in) */}
          {(!order.pointsEarned || order.pointsEarned === 0) && !user && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-6"
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-black/5 to-black/10 rounded-3xl p-6 md:p-8 border border-black/10">
                <div className="flex items-center gap-4 md:gap-6">
                  {/* Points Icon */}
                  <div className="shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-amber-100 rounded-2xl flex items-center justify-center">
                      <Coins size={28} weight="fill" className="text-amber-500" />
                    </div>
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg mb-1">
                      You could have earned ~{Math.floor(order.subtotal)} Care Points!
                    </p>
                    <p className="text-sm text-black/60 mb-3">
                      Create an account to start earning points on every purchase and unlock exclusive rewards.
                    </p>
                    <Link
                      href={`/register?email=${encodeURIComponent(order.customerEmail)}&redirect=/loyalty/rewards`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm rounded-full font-semibold hover:bg-black/80 transition-all"
                    >
                      Create Account
                      <ArrowRight size={16} weight="bold" />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Order Items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-black/[0.02] rounded-3xl p-6 md:p-8 mb-6"
          >
            <h2 className="font-bold text-lg mb-6 flex items-center gap-2">
              <Package size={20} weight="bold" />
              Order Items
            </h2>
            
            <div className="space-y-4">
              {order.items.map((item, index) => {
                const variantInfo = item.variantDetails ? JSON.parse(item.variantDetails) : null
                return (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex gap-4 p-4 bg-white rounded-2xl shadow-sm"
                  >
                    <div className="w-20 h-20 bg-black/5 rounded-xl overflow-hidden shrink-0">
                      {item.productImage ? (
                        <Image
                          src={item.productImage}
                          alt={item.productName}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={24} className="text-black/20" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.productName}</h3>
                      {variantInfo && (
                        <p className="text-sm text-black/50 mt-0.5">
                          {variantInfo.size && `Size: ${variantInfo.size}`}
                          {variantInfo.size && variantInfo.color && ' • '}
                          {variantInfo.color && `Color: ${variantInfo.color}`}
                        </p>
                      )}
                      <p className="text-sm text-black/50 mt-0.5">Qty: {item.quantity}</p>
                    </div>
                    <div className="font-semibold">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Price Breakdown */}
            <div className="mt-6 pt-6 border-t border-black/10 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-black/60">Subtotal</span>
                <span className="font-medium">${order.subtotal.toFixed(2)}</span>
              </div>
              {order.discount && order.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Discount</span>
                  <span className="font-medium text-green-600">-${order.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-black/60">Shipping</span>
                <span className="font-medium">{order.shipping === 0 ? 'FREE' : `$${order.shipping.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-black/60">Tax</span>
                <span className="font-medium">${order.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-3 border-t border-black/10">
                <span>Total</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          </motion.div>

          {/* Shipping Address */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-black/[0.02] rounded-3xl p-6 md:p-8 mb-6"
          >
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <MapPin size={20} weight="bold" />
              Shipping To
            </h2>
            <div className="text-black/70 leading-relaxed">
              <p className="font-semibold text-black">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
              </p>
              <p>{order.shippingAddress.address1}</p>
              {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
              </p>
            </div>
          </motion.div>

          {/* Tracking Info (if shipped) */}
          {order.trackingNumber && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-6 md:p-8 mb-6 border border-green-200"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center shrink-0">
                  <Truck size={28} weight="bold" className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-lg text-green-900 mb-1">Your Order Has Shipped! 🎉</h2>
                  <p className="text-sm text-green-700 mb-4">Track your package below.</p>
                  
                  <div className="bg-white/80 rounded-xl p-4 mb-4 space-y-3">
                    <div>
                      <p className="text-xs text-black/50 uppercase tracking-wide mb-1">Tracking Number</p>
                      <p className="font-mono font-semibold">{order.trackingNumber}</p>
                    </div>
                    {order.carrier && (
                      <div>
                        <p className="text-xs text-black/50 uppercase tracking-wide mb-1">Carrier</p>
                        <p className="font-medium">{order.carrier}</p>
                      </div>
                    )}
                    {order.estimatedDelivery && (
                      <div>
                        <p className="text-xs text-black/50 uppercase tracking-wide mb-1">Est. Delivery</p>
                        <p className="font-medium">
                          {new Date(order.estimatedDelivery).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                    {order.trackingUrl && (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-full font-semibold hover:bg-green-700 transition-all"
                      >
                        <Package size={18} weight="bold" />
                        Track Package
                      </a>
                    )}
                    <Link
                      href={`/order/track/${order.id}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-green-300 text-green-800 rounded-full font-semibold hover:bg-green-50 transition-all"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Info Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid md:grid-cols-2 gap-4 mb-6"
          >
            <div className="bg-black/[0.02] rounded-2xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shrink-0">
                <EnvelopeSimple size={20} weight="bold" className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Confirmation Sent</h3>
                <p className="text-sm text-black/60 leading-relaxed">
                  We&apos;ve sent details to {order.customerEmail}
                </p>
              </div>
            </div>
            
            <div className="bg-black/[0.02] rounded-2xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shrink-0">
                <Truck size={20} weight="bold" className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Shipping Updates</h3>
                <p className="text-sm text-black/60 leading-relaxed">
                  You&apos;ll receive updates as your order ships
                </p>
              </div>
            </div>
          </motion.div>

          {/* What's Next Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-black/[0.02] rounded-3xl p-6 md:p-8 mb-6"
          >
            <h2 className="font-bold text-lg mb-6">What&apos;s Next?</h2>
            <div className="space-y-4">
              {[
                { icon: Package, text: 'Your order will be processed within 1-2 business days' },
                { icon: Truck, text: 'Standard shipping typically takes 3-5 business days' },
                { icon: EnvelopeSimple, text: 'Track your order using the link in your confirmation email' },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-black/10 rounded-lg flex items-center justify-center shrink-0">
                    <step.icon size={16} weight="bold" className="text-black/60" />
                  </div>
                  <p className="text-black/70 pt-1">{step.text}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Review CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-3xl p-6 md:p-8 mb-8 border border-purple-100"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                <Star size={24} weight="fill" className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-lg mb-1">Share Your Experience</h2>
                <p className="text-sm text-black/60 mb-4">
                  Once you receive your items, we&apos;d love to hear what you think!
                </p>
                <div className="flex flex-wrap gap-2">
                  {order.items.slice(0, 3).map((item) => (
                    <Link
                      key={item.id}
                      href={`/products/${item.productName.toLowerCase().replace(/\s+/g, '-')}?writeReview=true&orderId=${order.id}`}
                      className="text-sm px-4 py-2 bg-white border border-purple-200 rounded-full hover:bg-purple-50 hover:border-purple-300 transition-all font-medium"
                    >
                      Review {item.productName}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-full font-semibold hover:bg-black/80 transition-all"
            >
              Continue Shopping
              <ArrowRight size={18} weight="bold" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black/5 text-black rounded-full font-semibold hover:bg-black/10 transition-all"
            >
              Back to Home
            </Link>
          </motion.div>

          {/* Support Link */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-sm text-black/50 text-center flex items-center justify-center gap-2"
          >
            <Heart size={14} weight="fill" className="text-red-400" />
            Questions? <Link href="/contact" className="text-black font-medium hover:underline">Contact us</Link>
          </motion.p>
        </div>
      </main>
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
