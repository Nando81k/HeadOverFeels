'use client'

import { useEffect, useState } from 'react'
import { Elements, useStripe, PaymentRequestButtonElement } from '@stripe/react-stripe-js'
import { loadStripe, type PaymentRequest } from '@stripe/stripe-js'
import type { CartItem } from '@/lib/store/cart'

// Inline constants to avoid importing server-only module
const SHIPPING_RATES = { STANDARD: 10, EXPRESS: 25, OVERNIGHT: 45 } as const
const FREE_SHIPPING_THRESHOLD = 100
const TAX_RATE = 0.08

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface ExpressCheckoutProps {
  items: CartItem[]
  subtotal: number
  onSuccess: (orderId: string) => void
}

export function ExpressCheckout(props: ExpressCheckoutProps) {
  return (
    <Elements stripe={stripePromise}>
      <ExpressCheckoutInner {...props} />
    </Elements>
  )
}

function ExpressCheckoutInner({ items, subtotal, onSuccess }: ExpressCheckoutProps) {
  const stripe = useStripe()
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null)

  useEffect(() => {
    if (!stripe || !items.length) return

    const standardShipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_RATES.STANDARD
    const tax = Math.round(subtotal * TAX_RATE * 100)
    const initialTotal = Math.round(subtotal * 100) + standardShipping * 100 + tax

    const pr = stripe.paymentRequest({
      country: 'US',
      currency: 'usd',
      total: { label: 'Head Over Feels', amount: initialTotal },
      requestPayerName: true,
      requestPayerEmail: true,
      requestShipping: true,
      shippingOptions: [
        {
          id: 'STANDARD',
          label: 'Standard (5–7 days)',
          detail: subtotal >= FREE_SHIPPING_THRESHOLD ? 'Free' : '$10.00',
          amount: standardShipping * 100,
        },
        { id: 'EXPRESS', label: 'Express (2–3 days)', detail: '$25.00', amount: 2500 },
        { id: 'OVERNIGHT', label: 'Overnight', detail: '$45.00', amount: 4500 },
      ],
    })

    pr.canMakePayment().then((result) => {
      if (result) setPaymentRequest(pr)
    })

    pr.on('shippingoptionchange', (ev) => {
      const method = ev.shippingOption.id as keyof typeof SHIPPING_RATES
      const rate = SHIPPING_RATES[method] ?? SHIPPING_RATES.STANDARD
      const isFreeStandard = method === 'STANDARD' && subtotal >= FREE_SHIPPING_THRESHOLD
      const shippingAmount = isFreeStandard ? 0 : rate * 100
      const updatedTax = Math.round(subtotal * TAX_RATE * 100)
      const updatedTotal = Math.round(subtotal * 100) + shippingAmount + updatedTax
      ev.updateWith({ status: 'success', total: { label: 'Head Over Feels', amount: updatedTotal } })
    })

    pr.on('paymentmethod', async (ev) => {
      const { payerEmail, payerName, shippingAddress, shippingOption, paymentMethod } = ev

      const sessionId =
        typeof window !== 'undefined' ? localStorage.getItem('sessionId') ?? undefined : undefined

      const res = await fetch('/api/orders/express', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.product.id,
            productVariantId: i.variant.id,
            quantity: i.quantity,
          })),
          payerEmail,
          payerName,
          shippingAddress,
          shippingOptionId: shippingOption?.id ?? 'STANDARD',
          sessionId,
        }),
      })

      if (!res.ok) {
        ev.complete('fail')
        return
      }

      const { clientSecret, orderId, error } = await res.json()
      if (error || !clientSecret) {
        ev.complete('fail')
        return
      }

      const { error: confirmError } = await stripe.confirmCardPayment(
        clientSecret,
        { payment_method: paymentMethod.id },
        { handleActions: false }
      )

      if (confirmError) {
        ev.complete('fail')
      } else {
        ev.complete('success')
        onSuccess(orderId)
      }
    })
  }, [stripe, subtotal]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!paymentRequest) return null

  return (
    <div>
      <p className="text-[10px] text-center text-black/40 uppercase tracking-[0.15em] mb-3">
        Express Checkout
      </p>
      <PaymentRequestButtonElement
        options={{
          paymentRequest,
          style: { paymentRequestButton: { height: '44px' } },
        }}
      />
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-black/10" />
        <span className="text-[11px] text-black/40">or</span>
        <div className="flex-1 h-px bg-black/10" />
      </div>
    </div>
  )
}
