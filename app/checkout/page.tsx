'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useCartStore } from '@/lib/store/cart'
import { ShippingForm, ShippingFormData } from '@/components/checkout/ShippingForm'
import { OrderSummary } from '@/components/checkout/OrderSummary'
import { PaymentForm } from '@/components/checkout/PaymentForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Lock, Check } from 'lucide-react'

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
}

const SHIPPING_OPTIONS: ShippingOption[] = [
  {
    id: 'STANDARD',
    name: 'Standard Shipping',
    price: 10,
    estimatedDays: '5-7 business days',
    description: 'Free on orders over $100'
  },
  {
    id: 'EXPRESS',
    name: 'Express Shipping',
    price: 25,
    estimatedDays: '2-3 business days',
    description: 'Faster delivery'
  },
  {
    id: 'OVERNIGHT',
    name: 'Overnight Shipping',
    price: 45,
    estimatedDays: '1 business day',
    description: 'Next day delivery'
  }
]

export default function CheckoutPage() {
  const router = useRouter()
  const { items, getTotalPrice, clearCart } = useCartStore()
  const [step, setStep] = useState<CheckoutStep>('shipping')
  const [loading, setLoading] = useState(false)
  const [clientSecret, setClientSecret] = useState<string>('')
  const [orderId, setOrderId] = useState<string>('')
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingFormData, string>>>({})
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod>('STANDARD')
  const [paymentSuccessful, setPaymentSuccessful] = useState(false)
  
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

  const subtotal = getTotalPrice()
  const selectedOption = SHIPPING_OPTIONS.find(opt => opt.id === selectedShippingMethod)!
  // Free standard shipping on orders over $100
  const shipping = selectedShippingMethod === 'STANDARD' && subtotal > 100 ? 0 : selectedOption.price
  const tax = subtotal * 0.08
  const total = subtotal + shipping + tax

  // Redirect if cart is empty (but not if payment was successful)
  useEffect(() => {
    if (items.length === 0 && !paymentSuccessful) {
      router.push('/cart')
    }
  }, [items, router, paymentSuccessful])

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ShippingFormData, string>> = {}

    // Required fields
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
    } else if (!/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(shippingData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number'
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
      // Scroll to first error
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
            // Using same as shipping for now
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
          shipping,
          tax,
          total,
          shippingMethod: selectedOption.name,
          sessionId: localStorage.getItem('sessionId') || undefined,
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
          amount: Math.round(total * 100), // Convert to cents
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
    // Set flag to prevent redirect to cart when clearing items
    setPaymentSuccessful(true)
    
    // Redirect to success page FIRST, then clear cart
    // This prevents the useEffect from detecting empty cart and redirecting to /cart
    router.push(`/order/confirmation?orderId=${orderId}&success=true`)
    
    // Clear cart after a short delay to ensure navigation happens first
    setTimeout(() => {
      clearCart()
    }, 100)
  }

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error)
  }

  if (items.length === 0) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 text-neutral-600 hover:text-black transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to cart
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Checkout</h1>
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Lock className="w-4 h-4" />
              Secure checkout
            </div>
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-4 mt-6">
            <div className={`flex items-center gap-2 ${step === 'shipping' ? 'text-black' : 'text-green-600'}`}>
              {step === 'payment' ? (
                <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-sm">
                  1
                </div>
              )}
              <span className="font-medium">Shipping</span>
            </div>
            <div className="flex-1 h-px bg-neutral-200" />
            <div className={`flex items-center gap-2 ${step === 'payment' ? 'text-black' : 'text-neutral-400'}`}>
              <div className={`w-6 h-6 rounded-full ${step === 'payment' ? 'bg-black text-white' : 'bg-neutral-200'} flex items-center justify-center text-sm`}>
                2
              </div>
              <span className="font-medium">Payment</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            {step === 'shipping' ? (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-6">Shipping Information</h2>
                <form onSubmit={handleSubmit}>
                  <ShippingForm
                    data={shippingData}
                    errors={errors}
                    onChange={setShippingData}
                  />
                  
                  {/* Shipping Method Selection */}
                  <div className="mt-8 pt-6 border-t">
                    <h3 className="text-lg font-semibold mb-4">Shipping Method</h3>
                    <div className="space-y-3">
                      {SHIPPING_OPTIONS.map((option) => {
                        const isFree = option.id === 'STANDARD' && subtotal > 100
                        const displayPrice = isFree ? 0 : option.price
                        
                        return (
                          <label
                            key={option.id}
                            className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              selectedShippingMethod === option.id
                                ? 'border-black bg-neutral-50'
                                : 'border-neutral-200 hover:border-neutral-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="shippingMethod"
                              value={option.id}
                              checked={selectedShippingMethod === option.id}
                              onChange={(e) => setSelectedShippingMethod(e.target.value as ShippingMethod)}
                              className="mt-1 w-4 h-4 text-black focus:ring-black"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-neutral-900">{option.name}</span>
                                <span className="font-bold text-neutral-900">
                                  {isFree ? (
                                    <span className="text-green-600">FREE</span>
                                  ) : (
                                    `$${displayPrice.toFixed(2)}`
                                  )}
                                </span>
                              </div>
                              <p className="text-sm text-neutral-600 mt-1">{option.estimatedDays}</p>
                              {isFree && option.id === 'STANDARD' && (
                                <p className="text-xs text-green-600 mt-1 font-medium">
                                  ✓ Free shipping unlocked
                                </p>
                              )}
                              {!isFree && option.id === 'STANDARD' && subtotal < 100 && subtotal > 0 && (
                                <p className="text-xs text-neutral-500 mt-1">
                                  {option.description}
                                </p>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t">
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Continue to Payment'}
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Payment</h2>
                  <button
                    onClick={() => setStep('shipping')}
                    className="text-sm text-neutral-600 hover:text-black"
                  >
                    Edit shipping
                  </button>
                </div>
                
                {/* Shipping summary */}
                <div className="mb-6 p-4 bg-neutral-50 rounded-lg text-sm">
                  <p className="font-medium mb-1">
                    {shippingData.firstName} {shippingData.lastName}
                  </p>
                  <p className="text-neutral-600">
                    {shippingData.address}
                    {shippingData.apartment && `, ${shippingData.apartment}`}
                  </p>
                  <p className="text-neutral-600">
                    {shippingData.city}, {shippingData.state} {shippingData.zipCode}
                  </p>
                </div>

                {/* Stripe payment form */}
                {clientSecret && (
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance: {
                        theme: 'stripe',
                        variables: {
                          colorPrimary: '#000000',
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
            )}
          </div>

          {/* Order summary sidebar */}
          <div className="lg:col-span-1">
            <OrderSummary 
              shippingCost={shipping}
              selectedShippingMethod={selectedOption.name}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
