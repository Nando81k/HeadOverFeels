'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
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
  ArrowDown
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

const LOYALTY_PENDING_ANIMATION_KEY = 'hof_loyalty_pending_animation'

function ConfirmationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, refreshUser } = useAuth()
  const success = searchParams.get('success')
  const orderId = searchParams.get('orderId')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initializedOrderIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!success || !orderId) {
      router.push('/products')
      return
    }

    if (initializedOrderIdRef.current === orderId) {
      return
    }
    initializedOrderIdRef.current = orderId

    const fetchOrderAndSendEmail = async () => {
      let fallbackPointsEarned = 0
      let loyaltyUpdated = false

      try {
        // Recovery pass: ensure order confirmation + loyalty processing runs even
        // when Stripe redirected back before frontend confirmation completed.
        const confirmResponse = await fetch(`/api/orders/${orderId}/confirm-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId: null }),
        })

        if (confirmResponse.ok) {
          const confirmData = await confirmResponse.json()
          fallbackPointsEarned = Number(confirmData.pointsEarned || 0)
          loyaltyUpdated = Boolean(
            confirmData.pointsEarned ||
            confirmData.tierUpgrade ||
            confirmData.recoveredLoyalty
          )
        }
      } catch (confirmError) {
        console.error('Failed to run payment confirmation fallback:', confirmError)
      }

      try {
        const response = await fetch(`/api/orders/${orderId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch order')
        }
        const data = await response.json()
        setOrder(data.data)

        const resolvedPointsEarned = Number(data.data?.pointsEarned || fallbackPointsEarned || 0)

        if (resolvedPointsEarned > 0) {
          try {
            localStorage.setItem(
              LOYALTY_PENDING_ANIMATION_KEY,
              JSON.stringify({
                orderId: data.data.id,
                customerId: user?.id || null,
                pointsEarned: resolvedPointsEarned,
                createdAt: Date.now(),
              })
            )
          } catch {
            // Ignore storage errors
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('hof:loyalty-updated', {
                detail: {
                  orderId: data.data.id,
                  pointsEarned: resolvedPointsEarned,
                },
              })
            )
          }
        }

        if (user && (resolvedPointsEarned > 0 || loyaltyUpdated)) {
          await refreshUser()
        }
        
        fetch(`/api/orders/${orderId}/send-confirmation`, {
          method: 'POST',
        }).catch((err) => {
          console.error('Failed to send confirmation email:', err)
        })
      } catch (err) {
        console.error('Error fetching order:', err)
        setError('Failed to load order details')
      } finally {
        setLoading(false)
      }
    }

    fetchOrderAndSendEmail()
  }, [success, orderId, router, user, refreshUser])

  if (!success || !orderId) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <CircleNotch size={40} weight="bold" className="animate-spin text-white/30" />
            <p className="text-sm text-white/50 uppercase tracking-widest">Loading your order...</p>
          </motion.div>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full text-center"
          >
            <div className="w-20 h-20 border border-white/20 flex items-center justify-center mx-auto mb-8">
              <Package size={32} weight="light" className="text-white/60" />
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-4">Order Not Found</h2>
            <p className="text-white/50 mb-10">{error || 'We couldn\'t find your order details.'}</p>
            <Link 
              href="/products"
              className="inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-semibold text-sm uppercase tracking-wider hover:bg-white/90 transition-all"
            >
              Continue Shopping
              <ArrowRight size={16} weight="bold" />
            </Link>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      
      {/* Hero Success Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        {/* Grain overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        
        {/* Animated corner accents */}
        <motion.div 
          className="absolute top-24 left-8 w-24 h-24 border-l border-t border-white/10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
        />
        <motion.div 
          className="absolute top-24 right-8 w-24 h-24 border-r border-t border-white/10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
        />

        <div className="relative z-10 text-center px-6 pt-24">
          {/* Success Icon */}
          <motion.div 
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", bounce: 0.4, delay: 0.2 }}
            className="relative inline-block mb-8"
          >
            <div className="w-24 h-24 border-2 border-white flex items-center justify-center">
              <CheckCircle size={48} weight="light" className="text-white" />
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="absolute -top-3 -right-3"
            >
              <Confetti size={24} weight="fill" className="text-[#FF3131]" />
            </motion.div>
          </motion.div>
          
          {/* Success Text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-[10px] font-medium tracking-[0.3em] text-white/40 uppercase block mb-4">
              Order #{order.orderNumber}
            </span>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-[clamp(2.5rem,10vw,6rem)] font-black leading-[0.9] tracking-tighter text-white uppercase mb-4"
          >
            Thank You
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-white/50 text-lg max-w-md mx-auto"
          >
            Your order has been confirmed and will be shipped soon.
          </motion.p>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, 8, 0] }}
            transition={{ 
              opacity: { delay: 1 },
              y: { duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1 }
            }}
            className="mt-16 flex flex-col items-center gap-2"
          >
            <span className="text-[10px] uppercase tracking-widest text-white/40">Order Details</span>
            <ArrowDown className="w-4 h-4 text-white/40" weight="bold" />
          </motion.div>
        </div>
      </section>

      {/* Order Details Section */}
      <section className="bg-[#F6F1EE] py-16 px-4">
        <div className="max-w-4xl mx-auto">
          
          {/* Care Points Earned */}
          {order.pointsEarned && order.pointsEarned > 0 && user && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <div className="relative bg-black p-8 md:p-10 overflow-hidden">
                {/* Accent lines */}
                <div className="absolute top-0 right-0 w-32 h-32 border-r border-t border-white/10" />
                <div className="absolute bottom-0 left-0 w-32 h-32 border-l border-b border-white/10" />
                
                <div className="relative flex items-center gap-6">
                  <motion.div
                    initial={{ rotate: -10, scale: 0 }}
                    whileInView={{ rotate: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3, type: "spring", bounce: 0.4 }}
                    className="shrink-0"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 border border-white/20 flex items-center justify-center">
                      <Coins size={32} weight="light" className="text-white" />
                    </div>
                  </motion.div>
                  
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2">
                      Loyalty Reward
                    </p>
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4 }}
                      className="flex items-baseline gap-3"
                    >
                      <span className="text-4xl md:text-5xl font-black text-white">
                        +{order.pointsEarned}
                      </span>
                      <span className="text-sm uppercase tracking-wider text-white/60">
                        Care Points
                      </span>
                    </motion.div>
                  </div>
                  
                  <Link
                    href="/profile#rewards"
                    className="hidden md:inline-flex items-center gap-2 px-6 py-3 bg-white text-black text-xs font-semibold uppercase tracking-wider hover:bg-white/90 transition-all"
                  >
                    View Rewards
                    <ArrowRight size={14} weight="bold" />
                  </Link>
                </div>
                
                <Link
                  href="/profile#rewards"
                  className="md:hidden mt-6 inline-flex items-center gap-2 text-xs font-semibold text-white uppercase tracking-wider hover:text-white/80 transition-colors"
                >
                  View your rewards
                  <ArrowRight size={14} weight="bold" />
                </Link>
              </div>
            </motion.div>
          )}

          {/* Sign Up CTA for Guest Users */}
          {(!order.pointsEarned || order.pointsEarned === 0) && !user && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <div className="relative bg-black/5 border border-black/10 p-8 md:p-10">
                <div className="flex items-center gap-6">
                  <div className="shrink-0">
                    <div className="w-14 h-14 border border-black/20 flex items-center justify-center">
                      <Coins size={24} weight="light" className="text-black/60" />
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-bold text-lg mb-1">
                      You could have earned ~{Math.floor(order.subtotal)} Care Points!
                    </p>
                    <p className="text-sm text-black/60 mb-4">
                      Create an account to earn points on every purchase.
                    </p>
                    <Link
                      href={`/signin?tab=signup&email=${encodeURIComponent(order.customerEmail)}&redirect=${encodeURIComponent('/profile#rewards')}`}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-black/80 transition-all"
                    >
                      Create Account
                      <ArrowRight size={14} weight="bold" />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Order Items */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="bg-white border border-black/10 p-6 md:p-8 mb-6"
          >
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50 mb-6 flex items-center gap-3">
              <Package size={16} weight="bold" />
              Order Items
            </h2>
            
            <div className="space-y-4">
              {order.items.map((item, index) => {
                const variantInfo = item.variantDetails ? JSON.parse(item.variantDetails) : null
                return (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="flex gap-4 p-4 bg-black/[0.02] border border-black/5"
                  >
                    <div className="w-20 h-20 bg-black/5 overflow-hidden shrink-0">
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
                        <p className="text-xs text-black/50 mt-1 uppercase tracking-wider">
                          {variantInfo.size && `Size: ${variantInfo.size}`}
                          {variantInfo.size && variantInfo.color && ' / '}
                          {variantInfo.color && `Color: ${variantInfo.color}`}
                        </p>
                      )}
                      <p className="text-xs text-black/50 mt-1">Qty: {item.quantity}</p>
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
                <span className="text-black/50 uppercase tracking-wider text-xs">Subtotal</span>
                <span className="font-medium">${order.subtotal.toFixed(2)}</span>
              </div>
              {order.discount && order.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 uppercase tracking-wider text-xs">Discount</span>
                  <span className="font-medium text-green-600">-${order.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-black/50 uppercase tracking-wider text-xs">Shipping</span>
                <span className="font-medium">{order.shipping === 0 ? 'FREE' : `$${order.shipping.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-black/50 uppercase tracking-wider text-xs">Tax</span>
                <span className="font-medium">${order.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-4 border-t border-black/10">
                <span className="uppercase tracking-wider text-sm">Total</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          </motion.div>

          {/* Shipping & Info Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Shipping Address */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-white border border-black/10 p-6 md:p-8"
            >
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50 mb-4 flex items-center gap-3">
                <MapPin size={16} weight="bold" />
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

            {/* Order Info */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25 }}
              className="bg-white border border-black/10 p-6 md:p-8"
            >
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50 mb-4 flex items-center gap-3">
                <Receipt size={16} weight="bold" />
                Order Info
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-black/40 mb-1">Order Number</p>
                  <p className="font-mono font-semibold">{order.orderNumber}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-black/40 mb-1">Confirmation Sent To</p>
                  <p className="text-sm">{order.customerEmail}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-black/40 mb-1">Order Date</p>
                  <p className="text-sm">
                    {new Date(order.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Tracking Info (if shipped) */}
          {order.trackingNumber && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-black p-6 md:p-8 mb-6"
            >
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 border border-white/20 flex items-center justify-center shrink-0">
                  <Truck size={24} weight="light" className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-lg text-white mb-1">Your Order Has Shipped!</h2>
                  <p className="text-sm text-white/60 mb-6">Track your package below.</p>
                  
                  <div className="bg-white/10 p-4 mb-6 space-y-4">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Tracking Number</p>
                      <p className="font-mono font-semibold text-white">{order.trackingNumber}</p>
                    </div>
                    {order.carrier && (
                      <div>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Carrier</p>
                        <p className="font-medium text-white">{order.carrier}</p>
                      </div>
                    )}
                    {order.estimatedDelivery && (
                      <div>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Est. Delivery</p>
                        <p className="font-medium text-white">
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
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black text-xs font-semibold uppercase tracking-wider hover:bg-white/90 transition-all"
                      >
                        <Package size={16} weight="bold" />
                        Track Package
                      </a>
                    )}
                    <Link
                      href={`/order/track/${order.id}`}
                      className="inline-flex items-center gap-2 px-6 py-3 border border-white/30 text-white text-xs font-semibold uppercase tracking-wider hover:bg-white/10 transition-all"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* What's Next */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.35 }}
            className="bg-white border border-black/10 p-6 md:p-8 mb-6"
          >
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50 mb-6">What&apos;s Next?</h2>
            <div className="space-y-4">
              {[
                { icon: Package, text: 'Your order will be processed within 1-2 business days' },
                { icon: Truck, text: 'Standard shipping typically takes 3-5 business days' },
                { icon: EnvelopeSimple, text: 'Track your order using the link in your confirmation email' },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 border border-black/10 flex items-center justify-center shrink-0">
                    <step.icon size={18} weight="light" className="text-black/60" />
                  </div>
                  <p className="text-black/70 pt-2 text-sm">{step.text}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Review CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="bg-black/5 border border-black/10 p-6 md:p-8 mb-10"
          >
            <div className="flex items-start gap-6">
              <div className="w-14 h-14 bg-black flex items-center justify-center shrink-0">
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
                      className="text-xs px-4 py-2.5 bg-white border border-black/10 hover:border-black/30 hover:bg-black/5 transition-all font-medium uppercase tracking-wider"
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
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-3 px-10 py-4 bg-black text-white font-semibold text-sm uppercase tracking-wider hover:bg-black/80 transition-all"
            >
              Continue Shopping
              <ArrowRight size={16} weight="bold" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-3 px-10 py-4 border border-black/20 text-black font-semibold text-sm uppercase tracking-wider hover:bg-black/5 transition-all"
            >
              Back to Home
            </Link>
          </motion.div>

          {/* Support Link */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-12 text-sm text-black/40 text-center flex items-center justify-center gap-2"
          >
            <Heart size={14} weight="fill" className="text-[#FF3131]" />
            Questions? <Link href="/contact" className="text-black font-medium hover:underline">Contact us</Link>
          </motion.p>
        </div>
      </section>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <CircleNotch size={40} weight="bold" className="animate-spin text-white/30" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  )
}
