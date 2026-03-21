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
  const cartTotals = getFinalTotal(baseShipping)
  
  // Override shipping if user selected non-standard method (cart store may have zeroed it for free_shipping coupons)
  const shipping = selectedShippingMethod !== 'STANDARD' ? selectedOption.price : cartTotals.shipping
  const discount = cartTotals.discount
  const tax = cartTotals.tax
  // Recalculate total with correct shipping
  const total = subtotal - discount + shipping + tax

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
            price: item.variant.price || item.product.price,
          })),
          subtotal,
          discount,
          shipping,
          tax,
          total,
          shippingMethod: selectedOption.name,
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
          amount: Math.round(total * 100),
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
      alert(error instanceof Error ? error.message : 'Failed to proceed to payment. Please try again.')
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
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 md:gap-6 mb-6 md:mb-10">
            <div className="flex items-center gap-3 md:gap-5">
              <div className="w-10 h-10 md:w-14 md:h-14 bg-black flex items-center justify-center">
                <CreditCard size={20} weight="bold" className="text-white md:hidden" />
                <CreditCard size={26} weight="bold" className="text-white hidden md:block" />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-0.5 md:mb-1">Secure</p>
                <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-black tracking-tight">Checkout</h1>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-black/40">
              <Lock size={14} weight="bold" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em]">SSL Encrypted</span>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center">
            {/* Step 1: Shipping */}
            <div className="flex items-center gap-2 md:gap-3">
              <motion.div 
                className={`w-9 h-9 md:w-12 md:h-12 flex items-center justify-center font-black text-xs md:text-sm transition-all ${
                  step === 'payment' 
                    ? 'bg-black text-white' 
                    : 'bg-black text-white'
                }`}
                whileHover={{ scale: 1.02 }}
              >
                {step === 'payment' ? <Check size={16} weight="bold" className="md:hidden" /> : '01'}
                {step === 'payment' && <Check size={20} weight="bold" className="hidden md:block" />}
              </motion.div>
              <div className="hidden sm:block">
                <p className="text-xs font-black text-black uppercase tracking-wide">Shipping</p>
                <p className="text-[10px] text-black/40 uppercase tracking-wider">Address & Delivery</p>
              </div>
            </div>
            
            {/* Progress Line */}
            <div className="flex-1 h-0.5 md:h-1 mx-2 md:mx-4 bg-black/10 overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: step === 'payment' ? '100%' : '0%' }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="h-full bg-black"
              />
            </div>
            
            {/* Step 2: Payment */}
            <div className="flex items-center gap-2 md:gap-3">
              <motion.div 
                className={`w-9 h-9 md:w-12 md:h-12 flex items-center justify-center font-black text-xs md:text-sm transition-all ${
                  step === 'payment' 
                    ? 'bg-black text-white' 
                    : 'bg-black/10 text-black/30'
                }`}
                whileHover={{ scale: 1.02 }}
              >
                02
              </motion.div>
              <div className="hidden sm:block">
                <p className={`text-xs font-black uppercase tracking-wide ${step === 'payment' ? 'text-black' : 'text-black/30'}`}>Payment</p>
                <p className="text-[10px] text-black/40 uppercase tracking-wider">Complete Order</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-6 lg:gap-12">
          {/* Order Summary - Collapsible on mobile, always visible on desktop */}
          <div className="lg:col-span-5 lg:order-2">
            <div className="border border-black/10 lg:sticky lg:top-28">
              {/* Summary Header - Clickable on mobile to toggle */}
              <button 
                onClick={() => setOrderSummaryExpanded(!orderSummaryExpanded)}
                className="w-full bg-black text-white px-4 md:px-6 py-3 md:py-4 flex items-center justify-between lg:cursor-default"
              >
                <div className="flex items-center gap-2 md:gap-3">
                  <Bag size={16} weight="bold" className="md:hidden" />
                  <Bag size={18} weight="bold" className="hidden md:block" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Order Summary</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black">{items.length} {items.length === 1 ? 'Item' : 'Items'}</span>
                  {/* Mobile toggle indicator */}
                  <div className="lg:hidden">
                    {orderSummaryExpanded ? (
                      <CaretUp size={16} weight="bold" />
                    ) : (
                      <CaretDown size={16} weight="bold" />
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
                        <PointsPreview orderTotal={total} isSignedIn={!!user} />
                      </div>
                    </div>

                    {/* Trust Badges - Hidden on mobile */}
                    <div className="hidden md:block border-t border-black/10 p-6 bg-black/2">
                      <div className="space-y-3">
                        {[
                          { icon: ShieldCheck, title: 'Secure Checkout', desc: 'SSL Encrypted' },
                          { icon: Package, title: 'Free Returns', desc: '30-Day Policy' },
                          { icon: Truck, title: 'Fast Shipping', desc: '2-3 Business Days' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white border border-black/10 flex items-center justify-center shrink-0">
                              <item.icon size={18} weight="bold" className="text-black/60" />
                            </div>
                            <div>
                              <p className="text-xs font-black text-black uppercase tracking-wide">{item.title}</p>
                              <p className="text-[10px] text-black/40">{item.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Compact Total Preview - Shown on mobile when collapsed */}
              <div className={`lg:hidden border-t border-black/10 px-4 py-3 bg-black/2 ${orderSummaryExpanded ? 'hidden' : ''}`}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-black uppercase tracking-wide">Total</span>
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
                  <div className="border border-black/10 overflow-hidden">
                    {/* Card Header */}
                    <div className="bg-black text-white px-4 md:px-6 py-3 md:py-4 flex items-center gap-2 md:gap-3">
                      <MapPin size={16} weight="bold" className="md:hidden" />
                      <MapPin size={18} weight="bold" className="hidden md:block" />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em]">Shipping Information</span>
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
                          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-black/5 flex items-center justify-center">
                              <Truck size={16} weight="bold" className="text-black md:hidden" />
                              <Truck size={18} weight="bold" className="text-black hidden md:block" />
                            </div>
                            <div>
                              <h3 className="text-xs md:text-sm font-black text-black uppercase tracking-wide">Delivery Method</h3>
                              <p className="text-[9px] md:text-[10px] text-black/40 uppercase tracking-wider">Select shipping speed</p>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            {SHIPPING_OPTIONS.map((option) => {
                              const isFreeFromAdmin = option.id === 'STANDARD' && isAdmin
                              const isFreeFromTier = option.id === 'STANDARD' && hasTierFreeShipping
                              const isFreeFromSubtotal = option.id === 'STANDARD' && subtotal > 100
                              const isFreeFromCoupon = option.id === 'STANDARD' && hasFreeShippingCoupon
                              const isFree = isFreeFromAdmin || isFreeFromTier || isFreeFromSubtotal || isFreeFromCoupon
                              const displayPrice = isFree ? 0 : option.price
                              const Icon = option.icon
                              
                              // Check if user qualifies for free standard but chose different method
                              const upgradeCost = option.id !== 'STANDARD' && qualifiesForFreeStandard 
                                ? option.price 
                                : null
                              
                              return (
                                <label
                                  key={option.id}
                                  className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 cursor-pointer transition-all ${
                                    selectedShippingMethod === option.id
                                      ? 'bg-black text-white'
                                      : 'bg-black/2 hover:bg-black/5 border border-black/10'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="shippingMethod"
                                    value={option.id}
                                    checked={selectedShippingMethod === option.id}
                                    onChange={(e) => setSelectedShippingMethod(e.target.value as ShippingMethod)}
                                    className="sr-only"
                                  />
                                  <div className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shrink-0 ${
                                    selectedShippingMethod === option.id 
                                      ? 'bg-white/20' 
                                      : 'bg-white border border-black/10'
                                  }`}>
                                    <Icon size={16} weight="bold" className={`md:hidden ${selectedShippingMethod === option.id ? 'text-white' : 'text-black/60'}`} />
                                    <Icon size={18} weight="bold" className={`hidden md:block ${selectedShippingMethod === option.id ? 'text-white' : 'text-black/60'}`} />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-black text-xs md:text-sm uppercase tracking-wide">{option.name}</span>
                                      <span className="font-black text-xs md:text-sm tabular-nums">
                                        {isFree ? (
                                          <span className="flex items-center gap-1">
                                            <Sparkle size={12} weight="fill" />
                                            FREE
                                          </span>
                                        ) : upgradeCost ? (
                                          <span className="flex items-center gap-1">
                                            +${upgradeCost.toFixed(2)}
                                          </span>
                                        ) : (
                                          `$${displayPrice.toFixed(2)}`
                                        )}
                                      </span>
                                    </div>
                                    <p className={`text-[10px] mt-1 uppercase tracking-wider ${selectedShippingMethod === option.id ? 'text-white/60' : 'text-black/40'}`}>
                                      {isFreeFromAdmin ? (
                                        <span className="flex items-center gap-1">
                                          <Crown size={10} weight="fill" /> Admin Perk
                                        </span>
                                      ) : isFreeFromTier ? (
                                        <span className="flex items-center gap-1">
                                          <Crown size={10} weight="fill" /> {user?.loyaltyTier?.name} Perk
                                        </span>
                                      ) : isFreeFromCoupon ? (
                                        <span className="flex items-center gap-1">
                                          <Sparkle size={10} weight="fill" /> Coupon Applied
                                        </span>
                                      ) : upgradeCost ? (
                                        <span>Upgrade from Free Standard • {option.estimatedDays}</span>
                                      ) : (
                                        option.estimatedDays
                                      )}
                                    </p>
                                  </div>
                                  {selectedShippingMethod === option.id && (
                                    <div className="w-6 h-6 bg-white/20 flex items-center justify-center">
                                      <Check size={14} weight="bold" />
                                    </div>
                                  )}
                                </label>
                              )
                            })}
                          </div>
                          
                          {/* Notice when user qualifies for free standard but chose upgraded shipping */}
                          {qualifiesForFreeStandard && selectedShippingMethod !== 'STANDARD' && (
                            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 flex items-start gap-2">
                              <Sparkle size={14} weight="fill" className="text-amber-600 shrink-0 mt-0.5" />
                              <p className="text-[10px] md:text-xs text-amber-800">
                                <span className="font-bold">You qualify for free standard shipping!</span>
                                {' '}You&apos;re paying an extra ${selectedOption.price.toFixed(2)} for {selectedOption.name.toLowerCase()} shipping.
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
                            className="w-full bg-black text-white font-black py-4 md:py-5 text-xs md:text-sm uppercase tracking-widest transition-all hover:bg-black/90 disabled:opacity-50 group flex items-center justify-center gap-2 md:gap-3"
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
                            {items.slice(0, 4).map((item, idx) => {
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
                              className="flex-1 max-w-[200px] bg-black text-white font-black py-3.5 text-xs uppercase tracking-widest transition-all active:bg-black/90 disabled:opacity-50 flex items-center justify-center gap-2"
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
                  {/* Shipping Summary */}
                  <div className="border border-black/10 overflow-hidden">
                    <div className="bg-black/5 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-7 h-7 md:w-8 md:h-8 bg-black flex items-center justify-center">
                          <Check size={12} weight="bold" className="text-white md:hidden" />
                          <Check size={14} weight="bold" className="text-white hidden md:block" />
                        </div>
                        <div>
                          <p className="text-[9px] md:text-[10px] font-black text-black uppercase tracking-[0.15em]">Shipping to</p>
                          <p className="text-[8px] md:text-[9px] text-black/40 uppercase tracking-wider">{selectedOption.name} • {selectedOption.estimatedDays}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setStep('shipping')}
                        className="text-[9px] md:text-[10px] font-black text-black/40 hover:text-black transition-colors uppercase tracking-wider"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="p-4 md:p-6">
                      <p className="font-black text-black">
                        {shippingData.firstName} {shippingData.lastName}
                      </p>
                      <p className="text-sm text-black/50 mt-1">
                        {shippingData.address}
                        {shippingData.apartment && `, ${shippingData.apartment}`}
                      </p>
                      <p className="text-sm text-black/50">
                        {shippingData.city}, {shippingData.state} {shippingData.zipCode}
                      </p>
                      <p className="text-sm text-black/50 mt-3">{shippingData.email}</p>
                    </div>
                  </div>
                  
                  {/* Payment Form Card */}
                  <div className="border border-black/10 overflow-hidden">
                    {/* Card Header */}
                    <div className="bg-black text-white px-4 md:px-6 py-3 md:py-4 flex items-center gap-2 md:gap-3">
                      <CreditCard size={16} weight="bold" className="md:hidden" />
                      <CreditCard size={18} weight="bold" className="hidden md:block" />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em]">Payment Details</span>
                    </div>

                    <div className="p-4 md:p-6 lg:p-8">
                      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-black/10">
                        <Lock size={12} weight="bold" className="text-black/30" />
                        <span className="text-[10px] text-black/40 uppercase tracking-wider">All transactions are secure and encrypted</span>
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
