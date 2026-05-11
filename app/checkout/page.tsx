'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useCartStore } from '@/lib/store/cart'
import { ShippingForm, ShippingFormData } from '@/components/checkout/ShippingForm'
import { PaymentForm } from '@/components/checkout/PaymentForm'
import { CouponInput } from '@/components/checkout/CouponInput'
import { PointsPreview } from '@/components/checkout/PointsPreview'
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps'
import { useTierAccent } from '@/lib/loyalty/use-tier-accent'
import { calculateCheckoutSavings } from '@/lib/checkout/insights'
import { toast } from '@/lib/toast'
import { isValidPhoneNumber } from '@/lib/utils/phone'
import { useAuth } from '@/lib/auth/context'
import { Navigation } from '@/components/layout/Navigation'
import { 
  ArrowLeft, 
  Lock, 
  Check, 
  Truck, 
  Package, 
  ShieldCheck, 
  ArrowRight, 
  MapPin, 
  CreditCard, 
  Sparkle,
  CircleNotch,
  Crown,
  Lightning,
  Bag,
  CaretDown,
  CaretUp
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type CheckoutStep = 'shipping' | 'payment'

type ShippingMethod = 'STANDARD' | 'EXPRESS' | 'OVERNIGHT'

interface ShippingOption {
  id: ShippingMethod
  name: string
  price: number
  estimatedDays: string
  description: string
  icon: typeof Truck
}

const SHIPPING_OPTIONS: ShippingOption[] = [
  {
    id: 'STANDARD',
    name: 'Standard',
    price: 10,
    estimatedDays: '5-7 business days',
    description: 'Free on orders over $100',
    icon: Package
  },
  {
    id: 'EXPRESS',
    name: 'Express',
    price: 25,
    estimatedDays: '2-3 business days',
    description: 'Faster delivery',
    icon: Truck
  },
  {
    id: 'OVERNIGHT',
    name: 'Overnight',
    price: 45,
    estimatedDays: 'Next business day',
    description: 'Priority delivery',
    icon: Sparkle
  }
]

export default function CheckoutPage() {
  const router = useRouter()
  const { user } = useAuth()
  const tierAccent = useTierAccent()
  const { items, getTotalPrice, clearCart, appliedCoupon, getFinalTotal, removeCoupon } = useCartStore()
  const [step, setStep] = useState<CheckoutStep>('shipping')
  const [loading, setLoading] = useState(false)
  const [clientSecret, setClientSecret] = useState<string>('')
  const [orderId, setOrderId] = useState<string>('')
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingFormData, string>>>({})
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod>('STANDARD')
  const [paymentSuccessful, setPaymentSuccessful] = useState(false)
  const [orderSummaryExpanded, setOrderSummaryExpanded] = useState(false)
  
  const [shippingData, setShippingData] = useState<ShippingFormData>({
    firstName: '',
    lastName: '',
    email: '',
    newsletterOptIn: false,
    phone: '',
    address: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
  })

  useEffect(() => {
    if (!user?.email) return

    setShippingData((prev) => {
      if (prev.email.trim().length > 0) {
        return prev
      }

      return {
        ...prev,
        email: user.email,
      }
    })
  }, [user?.email])

  const subtotal = getTotalPrice()
  const selectedOption = SHIPPING_OPTIONS.find(opt => opt.id === selectedShippingMethod)!
  const taxRate = 0.08
  
  // Check if user is admin
  const isAdmin = user?.isAdmin === true
  // Check if user has free shipping perk from loyalty tier
  const hasTierFreeShipping = user?.loyaltyTier?.freeShipping === true
  // Check if user has free shipping coupon (only applies to standard shipping)
  const hasFreeShippingCoupon = appliedCoupon?.discountType === 'free_shipping'
  
  // Determine if user qualifies for free STANDARD shipping
  const qualifiesForFreeStandard = isAdmin || hasTierFreeShipping || subtotal > 100 || hasFreeShippingCoupon
  
  // Free shipping only applies to STANDARD - upgraded shipping always costs extra
  const baseShipping = selectedShippingMethod === 'STANDARD' && qualifiesForFreeStandard
    ? 0
    : selectedOption.price
  
  // Calculate final totals with coupon applied
  // We pass baseShipping which already accounts for free standard shipping
  // The cart store's free_shipping coupon logic is overridden here
  const cartTotals = getFinalTotal(baseShipping, taxRate)
  
  // Override shipping if user selected non-standard method (cart store may have zeroed it for free_shipping coupons)
  const shipping = selectedShippingMethod !== 'STANDARD' ? selectedOption.price : cartTotals.shipping
  const discount = cartTotals.discount
  const tax = cartTotals.tax
  // Recalculate total with correct shipping
  const total = subtotal - discount + shipping + tax
  const savings = calculateCheckoutSavings({
    subtotal,
    discount,
    shipping,
    baseShippingPrice: selectedOption.price,
    tax,
    taxRate,
  })
  const activeOfferTags: string[] = []
  if (appliedCoupon) {
    activeOfferTags.push(`${appliedCoupon.rewardName}${appliedCoupon.code ? ` (${appliedCoupon.code})` : ''}`)
  }
  if (selectedShippingMethod === 'STANDARD' && shipping === 0) {
    if (isAdmin) {
      activeOfferTags.push('Admin Free Shipping')
    } else if (hasTierFreeShipping) {
      activeOfferTags.push(`${user?.loyaltyTier?.name || 'Tier'} Free Shipping`)
    } else if (hasFreeShippingCoupon && !appliedCoupon) {
      activeOfferTags.push('Free Shipping Coupon')
    } else if (subtotal > 100) {
      activeOfferTags.push('Free Shipping Over $100')
    }
  }
  const activePromotionText = activeOfferTags.join(' • ') || null

  // Redirect if cart is empty (but not if payment was successful)
  useEffect(() => {
    if (items.length === 0 && !paymentSuccessful) {
      router.push('/cart')
    }
  }, [items, router, paymentSuccessful])

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ShippingFormData, string>> = {}

    if (!shippingData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }
    if (!shippingData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }
    if (!shippingData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    if (!shippingData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    } else if (!isValidPhoneNumber(shippingData.phone)) {
      newErrors.phone = 'Please enter a valid 10-digit phone number'
    }
    if (!shippingData.address.trim()) {
      newErrors.address = 'Address is required'
    }
    if (!shippingData.city.trim()) {
      newErrors.city = 'City is required'
    }
    if (!shippingData.state) {
      newErrors.state = 'State is required'
    }
    if (!shippingData.zipCode.trim()) {
      newErrors.zipCode = 'ZIP code is required'
    } else if (!/^\d{5}(-\d{4})?$/.test(shippingData.zipCode)) {
      newErrors.zipCode = 'Please enter a valid ZIP code'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      const firstError = document.querySelector('[class*="border-red"]')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setLoading(true)

    try {
      // 1. Create order in database
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: shippingData.email,
          customerPhone: shippingData.phone,
          newsletterOptIn: shippingData.newsletterOptIn,
          shippingAddress: {
            firstName: shippingData.firstName,
            lastName: shippingData.lastName,
            address1: shippingData.address,
            address2: shippingData.apartment || undefined,
            city: shippingData.city,
            state: shippingData.state,
            postalCode: shippingData.zipCode,
            country: shippingData.country,
          },
          billingAddress: {
            firstName: shippingData.firstName,
            lastName: shippingData.lastName,
            address1: shippingData.address,
            address2: shippingData.apartment || undefined,
            city: shippingData.city,
            state: shippingData.state,
            postalCode: shippingData.zipCode,
            country: shippingData.country,
          },
          items: items.map(item => ({
            productId: item.product.id,
            productVariantId: item.variant.id,
            quantity: item.quantity,
          })),
          shippingMethod: selectedOption.id,
          sessionId: localStorage.getItem('sessionId') || undefined,
          couponCode: appliedCoupon?.code || undefined,
          redemptionId: appliedCoupon?.redemptionId || undefined,
          promotionId: appliedCoupon?.promotionId || undefined,
        }),
      })

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json()
        throw new Error(errorData.error || 'Failed to create order')
      }

      const orderData = await orderResponse.json()
      const createdOrderId = orderData.order.id
      setOrderId(createdOrderId)

      // 2. Create payment intent with order ID in metadata
      const response = await fetch('/api/stripe/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(orderData.order.total * 100),
          currency: 'usd',
          metadata: {
            orderId: createdOrderId,
            customerEmail: shippingData.email,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create payment intent')
      }

      const data = await response.json()
      setClientSecret(data.clientSecret)
      setStep('payment')
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to proceed to payment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = () => {
    setPaymentSuccessful(true)
    router.push(`/order/confirmation?orderId=${orderId}&success=true`)
    setTimeout(() => {
      removeCoupon()
      clearCart()
    }, 100)
  }

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error)
  }

  // Helper to get image URL
  const getImageUrl = (images: string): string | null => {
    try {
      const parsed = JSON.parse(images)
      if (parsed && parsed.length > 0) {
        const first = parsed[0]
        if (typeof first === 'string' && first.startsWith('http')) return first
        if (first?.url && first.url.startsWith('http')) return first.url
      }
    } catch {
      // ignore
    }
    return null
  }

  if (items.length === 0) {
    return null
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-28 pb-12 md:pb-20">
        {/* Back navigation */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-4 md:mb-8"
        >
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 text-black/40 hover:text-black transition-colors group"
          >
            <ArrowLeft size={16} weight="bold" className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Back to Cart</span>
          </Link>
        </motion.div>
        
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 md:mb-12"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 md:gap-6 mb-6 md:mb-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-1">Secure</p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black tracking-tight">CHECKOUT</h1>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-black/40">
              <Lock size={12} weight="bold" />
              <span className="text-[10px] font-black uppercase tracking-[0.16em]">SSL Encrypted</span>
            </div>
          </div>

          <CheckoutSteps current={step} />
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-6 lg:gap-12">
          {/* Order Summary - Collapsible on mobile, always visible on desktop */}
          <div className="lg:col-span-5 lg:order-2">
            <div className="border border-black/10 lg:sticky lg:top-28">
              {/* Summary Header - hairline editorial bar; clickable on mobile to toggle */}
              <button
                onClick={() => setOrderSummaryExpanded(!orderSummaryExpanded)}
                className="w-full px-4 md:px-6 py-3 md:py-4 flex items-center justify-between border-b border-black/10 text-black hover:bg-black/2 lg:cursor-default lg:hover:bg-transparent"
              >
                <div className="flex items-center gap-2">
                  <Bag size={14} weight="bold" className="text-black/55" />
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/65">Order Summary</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
                    {items.length} {items.length === 1 ? 'Item' : 'Items'}
                  </span>
                  <div className="lg:hidden text-black/45">
                    {orderSummaryExpanded ? (
                      <CaretUp size={14} weight="bold" />
                    ) : (
                      <CaretDown size={14} weight="bold" />
                    )}
                  </div>
                </div>
              </button>

              {/* Collapsible Content - Hidden by default on mobile, always shown on desktop */}
              <AnimatePresence initial={false}>
                {(orderSummaryExpanded || typeof window !== 'undefined') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ 
                      height: orderSummaryExpanded ? 'auto' : 0, 
                      opacity: orderSummaryExpanded ? 1 : 0 
                    }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden lg:h-auto! lg:opacity-100!"
                  >
                    <div className="p-4 md:p-6">
                      {/* Cart Items - Compact on mobile */}
                      <div className="space-y-3 md:space-y-4 mb-4 md:mb-6 max-h-[200px] md:max-h-[280px] overflow-y-auto pr-2">
                        {items.map((item) => {
                          const price = item.variant.price || item.product.price
                          const imageUrl = getImageUrl(item.product.images)

                          return (
                            <div key={`${item.product.id}-${item.variant.id}-summary`} className="flex gap-3 md:gap-4">
                              <div className="relative w-12 h-12 md:w-16 md:h-16 bg-black/5 overflow-hidden shrink-0">
                                {imageUrl ? (
                                  <Image
                                    src={imageUrl}
                                    alt={item.product.name}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package size={16} weight="bold" className="text-black/30" />
                                  </div>
                                )}
                                <div className="absolute -top-0.5 -right-0.5 bg-black text-white text-[8px] md:text-[10px] font-black w-4 h-4 md:w-5 md:h-5 flex items-center justify-center">
                                  {item.quantity}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-[10px] md:text-xs font-black text-black truncate uppercase tracking-wide">
                                  {item.product.name}
                                </h3>
                                <p className="text-[8px] md:text-[10px] text-black/40 mt-0.5 uppercase tracking-wider">
                                  {item.variant.size && `${item.variant.size}`}
                                  {item.variant.size && item.variant.color && ' / '}
                                  {item.variant.color && `${item.variant.color}`}
                                </p>
                                <p className="text-xs md:text-sm font-black text-black mt-1 md:mt-2 tabular-nums">
                                  ${(price * item.quantity).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Coupon Input */}
                      <div className="border-t border-black/10 pt-3 md:pt-4 mb-3 md:mb-4">
                        <CouponInput />
                      </div>

                      {/* Price Breakdown - Compact */}
                      <div className="space-y-2 md:space-y-3 border-t border-black/10 pt-3 md:pt-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs md:text-sm text-black/60">Subtotal</span>
                          <span className="text-xs md:text-sm font-black text-black tabular-nums">${subtotal.toFixed(2)}</span>
                        </div>
                        
                        {discount > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs md:text-sm text-black/60 flex items-center gap-1">
                              <Lightning size={12} weight="fill" className="text-black" />
                              Discount
                            </span>
                            <span className="text-xs md:text-sm font-black text-black tabular-nums">-${discount.toFixed(2)}</span>
                          </div>
                        )}

                        {activePromotionText && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs md:text-sm text-black/60">Active offer</span>
                            <span className="text-[10px] md:text-xs font-bold text-black uppercase tracking-wide text-right">
                              {activePromotionText}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-xs md:text-sm text-black/60">Shipping</span>
                            <span className="text-[9px] md:text-[10px] text-black/40 block uppercase tracking-wider">{selectedOption.name}</span>
                          </div>
                          {shipping === 0 ? (
                            <span className="text-xs md:text-sm font-black text-black flex items-center gap-1">
                              <Sparkle size={12} weight="fill" />
                              FREE
                            </span>
                          ) : (
                            <span className="text-xs md:text-sm font-black text-black tabular-nums">${shipping.toFixed(2)}</span>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-xs md:text-sm text-black/60">Tax</span>
                          <span className="text-xs md:text-sm font-black text-black tabular-nums">${tax.toFixed(2)}</span>
                        </div>

                        {savings.totalSavings > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs md:text-sm text-black/60">You save today</span>
                            <span className="text-xs md:text-sm font-black text-emerald-700 tabular-nums">
                              ${savings.totalSavings.toFixed(2)}
                            </span>
                          </div>
                        )}

                        {/* Total */}
                        <div className="pt-3 md:pt-4 mt-3 md:mt-4 border-t-2 border-black">
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs font-black text-black uppercase tracking-wide">Total</span>
                            <span className="text-2xl md:text-3xl font-black text-black tabular-nums">${total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Care Points Preview */}
                      <div className="mt-4 md:mt-6">
                        <PointsPreview
                          pointsEligibleAmount={total}
                          isSignedIn={!!user}
                          activePromotionText={activePromotionText}
                          totalSavings={savings.totalSavings}
                        />
                      </div>
                    </div>

                    {/* Trust badges — single inline row, ultra-compact. */}
                    <div className="hidden md:flex border-t border-black/10 px-4 py-2 items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-black/55">
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck size={12} weight="bold" /> SSL
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Package size={12} weight="bold" /> 30-Day Returns
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Truck size={12} weight="bold" /> 2–3 Days
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Compact Total Preview - Shown on mobile when collapsed */}
              <div className={`lg:hidden border-t border-black/10 px-4 py-3 ${orderSummaryExpanded ? 'hidden' : ''}`}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-black/55 uppercase tracking-[0.18em]">Total</span>
                  <span className="text-xl font-black text-black tabular-nums">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Form */}
          <div className="lg:col-span-7 lg:order-1">
            <AnimatePresence mode="wait">
              {step === 'shipping' ? (
                <motion.div
                  key="shipping"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Shipping Form Card */}
                  <div className="border border-black/10">
                    {/* Card Header */}
                    <div className="px-4 md:px-6 py-3 md:py-4 flex items-center gap-2 md:gap-3 border-b border-black/10">
                      <MapPin size={14} weight="bold" className="text-black/55" />
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/65">Shipping Information</span>
                    </div>

                    <div className="p-4 md:p-6 lg:p-8">
                      <form onSubmit={handleSubmit}>
                        <ShippingForm
                          data={shippingData}
                          errors={errors}
                          onChange={setShippingData}
                        />
                        
                        {/* Shipping Method Selection */}
                        <div className="mt-6 md:mt-10 pt-6 md:pt-8 border-t border-black/10">
                          <div className="flex items-center justify-between mb-4 md:mb-5">
                            <div>
                              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-black/65">Delivery Method</h3>
                              <p className="text-[10px] text-black/45 mt-0.5">Choose your shipping speed</p>
                            </div>
                            <Truck size={14} weight="bold" className="text-black/40" />
                          </div>

                          <div className="space-y-2">
                            {SHIPPING_OPTIONS.map((option) => {
                              const isFreeFromAdmin = option.id === 'STANDARD' && isAdmin
                              const isFreeFromTier = option.id === 'STANDARD' && hasTierFreeShipping
                              const isFreeFromSubtotal = option.id === 'STANDARD' && subtotal > 100
                              const isFreeFromCoupon = option.id === 'STANDARD' && hasFreeShippingCoupon
                              const isFree = isFreeFromAdmin || isFreeFromTier || isFreeFromSubtotal || isFreeFromCoupon
                              const displayPrice = isFree ? 0 : option.price
                              const Icon = option.icon
                              const isSelected = selectedShippingMethod === option.id

                              const upgradeCost = option.id !== 'STANDARD' && qualifiesForFreeStandard
                                ? option.price
                                : null

                              return (
                                <label
                                  key={option.id}
                                  style={isSelected ? { borderLeftColor: tierAccent.accent } : undefined}
                                  className={`flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 cursor-pointer transition-colors border-l-2 ${
                                    isSelected
                                      ? 'border-y border-r border-black/15 bg-black/2'
                                      : 'border-y border-r border-transparent bg-transparent hover:bg-black/2'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="shippingMethod"
                                    value={option.id}
                                    checked={isSelected}
                                    onChange={(e) => setSelectedShippingMethod(e.target.value as ShippingMethod)}
                                    className="sr-only"
                                  />
                                  <Icon
                                    size={18}
                                    weight="bold"
                                    className={isSelected ? 'text-black' : 'text-black/40'}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline justify-between gap-2">
                                      <span className={`text-xs md:text-sm font-black uppercase tracking-[0.12em] ${isSelected ? 'text-black' : 'text-black/80'}`}>
                                        {option.name}
                                      </span>
                                      <span className={`text-xs md:text-sm font-black tabular-nums ${isSelected ? 'text-black' : 'text-black/70'}`}>
                                        {isFree ? (
                                          <span className="inline-flex items-center gap-1">
                                            <Sparkle size={11} weight="fill" />
                                            FREE
                                          </span>
                                        ) : upgradeCost ? (
                                          <span>+${upgradeCost.toFixed(2)}</span>
                                        ) : (
                                          `$${displayPrice.toFixed(2)}`
                                        )}
                                      </span>
                                    </div>
                                    <div className="mt-0.5">
                                      {isFreeFromAdmin ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-black/55">
                                          <Crown size={10} weight="fill" /> Admin Perk
                                        </span>
                                      ) : isFreeFromTier ? (
                                        <span
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]"
                                          style={{ backgroundColor: tierAccent.accentSoft, color: tierAccent.accentDark }}
                                        >
                                          <Crown size={10} weight="fill" /> {user?.loyaltyTier?.name} Perk
                                        </span>
                                      ) : isFreeFromCoupon ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-black/55">
                                          <Sparkle size={10} weight="fill" /> Coupon Applied
                                        </span>
                                      ) : upgradeCost ? (
                                        <span className="text-[10px] uppercase tracking-[0.12em] text-black/50">Upgrade · {option.estimatedDays}</span>
                                      ) : (
                                        <span className="text-[10px] uppercase tracking-[0.12em] text-black/50">{option.estimatedDays}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div
                                    className={`shrink-0 h-5 w-5 inline-flex items-center justify-center transition-all ${
                                      isSelected ? 'opacity-100' : 'opacity-0'
                                    }`}
                                    style={isSelected ? { color: tierAccent.accent } : undefined}
                                    aria-hidden="true"
                                  >
                                    <Check size={14} weight="bold" />
                                  </div>
                                </label>
                              )
                            })}
                          </div>

                          {/* Notice when user qualifies for free standard but chose upgraded shipping */}
                          {qualifiesForFreeStandard && selectedShippingMethod !== 'STANDARD' && (
                            <div className="mt-3 border-l-2 border-amber-500 bg-amber-50/60 py-2 pl-3 flex items-start gap-2">
                              <Sparkle size={13} weight="fill" className="text-amber-600 shrink-0 mt-0.5" />
                              <p className="text-[11px] text-amber-900">
                                <span className="font-black uppercase tracking-[0.12em]">Free standard available.</span>
                                {' '}You&apos;re paying an extra ${selectedOption.price.toFixed(2)} for {selectedOption.name.toLowerCase()}.
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {/* Desktop Continue Button */}
                        <div className="hidden lg:block mt-6 md:mt-10">
                          <motion.button
                            type="submit"
                            disabled={loading}
                            whileHover={{ scale: loading ? 1 : 1.01 }}
                            whileTap={{ scale: loading ? 1 : 0.99 }}
                            style={{ backgroundColor: tierAccent.accent }}
                            className="w-full text-white font-black py-4 md:py-5 text-xs md:text-sm uppercase tracking-[0.16em] transition-all hover:brightness-90 disabled:opacity-50 group flex items-center justify-center gap-2 md:gap-3"
                          >
                            {loading ? (
                              <>
                                <CircleNotch size={18} weight="bold" className="animate-spin" />
                                Processing
                              </>
                            ) : (
                              <>
                                Continue to Payment
                                <ArrowRight size={18} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                              </>
                            )}
                          </motion.button>
                        </div>

                        {/* Mobile Condensed Order Summary + Continue Button */}
                        <div className="lg:hidden mt-6 border-t border-black/10 pt-4">
                          {/* Mini cart items preview */}
                          <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2">
                            {items.slice(0, 4).map((item) => {
                              const imageUrl = getImageUrl(item.product.images)
                              return (
                                <div key={`mini-${item.product.id}-${item.variant.id}`} className="relative w-10 h-10 bg-black/5 shrink-0 overflow-hidden">
                                  {imageUrl ? (
                                    <Image src={imageUrl} alt={item.product.name} fill className="object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package size={12} weight="bold" className="text-black/30" />
                                    </div>
                                  )}
                                  <div className="absolute -top-0.5 -right-0.5 bg-black text-white text-[7px] font-black w-3 h-3 flex items-center justify-center">
                                    {item.quantity}
                                  </div>
                                </div>
                              )
                            })}
                            {items.length > 4 && (
                              <div className="w-10 h-10 bg-black/5 shrink-0 flex items-center justify-center">
                                <span className="text-[9px] font-black text-black/50">+{items.length - 4}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Total and Continue */}
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-[9px] text-black/40 uppercase tracking-wider">Total</p>
                              <p className="text-xl font-black text-black tabular-nums">${total.toFixed(2)}</p>
                            </div>
                            <motion.button
                              type="submit"
                              disabled={loading}
                              whileTap={{ scale: loading ? 1 : 0.98 }}
                              style={{ backgroundColor: tierAccent.accent }}
                              className="flex-1 max-w-[200px] text-white font-black py-3.5 text-xs uppercase tracking-[0.16em] transition-all active:brightness-90 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {loading ? (
                                <>
                                  <CircleNotch size={16} weight="bold" className="animate-spin" />
                                  <span>Processing</span>
                                </>
                              ) : (
                                <>
                                  <span>Continue</span>
                                  <ArrowRight size={16} weight="bold" />
                                </>
                              )}
                            </motion.button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Shipping Summary — flush hairline recap with tier-color check icon */}
                  <div className="border border-black/10">
                    <div className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between border-b border-black/10">
                      <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <div
                          className="w-6 h-6 inline-flex items-center justify-center shrink-0"
                          style={{ backgroundColor: tierAccent.accent }}
                        >
                          <Check size={12} weight="bold" className="text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-black/65 uppercase tracking-[0.18em]">Shipping to</p>
                          <p className="text-[10px] text-black/45 uppercase tracking-[0.12em] truncate">{selectedOption.name} · {selectedOption.estimatedDays}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setStep('shipping')}
                        className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55 hover:text-black underline underline-offset-4 decoration-black/20 hover:decoration-black transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="p-4 md:p-6">
                      <p className="text-sm font-black tracking-tight text-black">
                        {shippingData.firstName} {shippingData.lastName}
                      </p>
                      <p className="text-sm text-black/60 mt-1">
                        {shippingData.address}
                        {shippingData.apartment && `, ${shippingData.apartment}`}
                      </p>
                      <p className="text-sm text-black/60">
                        {shippingData.city}, {shippingData.state} {shippingData.zipCode}
                      </p>
                      <p className="text-xs text-black/50 mt-3 uppercase tracking-[0.12em]">{shippingData.email}</p>
                    </div>
                  </div>

                  {/* Payment Form Card */}
                  <div className="border border-black/10">
                    {/* Card Header */}
                    <div className="px-4 md:px-6 py-3 md:py-4 flex items-center gap-2 md:gap-3 border-b border-black/10">
                      <CreditCard size={14} weight="bold" className="text-black/55" />
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/65">Payment Details</span>
                    </div>

                    <div className="p-4 md:p-6 lg:p-8">
                      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-black/5">
                        <Lock size={12} weight="bold" className="text-black/30" />
                        <span className="text-[10px] text-black/45 uppercase tracking-[0.14em]">All transactions are secure and encrypted</span>
                      </div>

                      {clientSecret && (
                        <Elements
                          stripe={stripePromise}
                          options={{
                            clientSecret,
                            appearance: {
                              theme: 'stripe',
                              variables: {
                                colorPrimary: '#000000',
                                colorBackground: '#ffffff',
                                colorText: '#000000',
                                colorDanger: '#dc2626',
                                fontFamily: 'system-ui, sans-serif',
                                borderRadius: '0px',
                              },
                              rules: {
                                '.Input': {
                                  border: '1px solid rgba(0,0,0,0.1)',
                                  boxShadow: 'none',
                                  padding: '14px 16px',
                                },
                                '.Input:focus': {
                                  border: '2px solid #000000',
                                  boxShadow: 'none',
                                },
                                '.Label': {
                                  fontWeight: '700',
                                  color: '#000000',
                                  marginBottom: '8px',
                                  fontSize: '10px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.1em',
                                },
                              },
                            },
                          }}
                        >
                          <PaymentForm
                            amount={total}
                            orderId={orderId}
                            onSuccess={handlePaymentSuccess}
                            onError={handlePaymentError}
                          />
                        </Elements>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
